import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../public/glass-figure/glass-figure.js", import.meta.url), "utf8");
type Handler = (event: Record<string, unknown>) => void;
class EventTargetStub {
  listeners = new Map<string, Set<Handler>>();
  addEventListener(type: string, handler: Handler) {
    const handlers = this.listeners.get(type) ?? new Set<Handler>();
    handlers.add(handler); this.listeners.set(type, handlers);
  }
  removeEventListener(type: string, handler: Handler) { this.listeners.get(type)?.delete(handler); }
  emit(type: string, event: Record<string, unknown> = {}) { this.listeners.get(type)?.forEach(handler => handler(event)); }
}

function renderer({ coarse = false, failShader = false } = {}) {
  let now = 0, sequence = 0, draws = 0, released = 0, deletedBuffers = 0, deletedPrograms = 0, deletedShaders = 0;
  const frames = new Map<number, (time: number) => void>();
  const gl = new Proxy({
    getShaderParameter: () => !failShader,
    getProgramParameter: () => true,
    createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}),
    getExtension: () => ({ loseContext: () => { released++; } }),
    drawArrays: () => { draws++; },
    deleteBuffer: () => { deletedBuffers++; },
    deleteProgram: () => { deletedPrograms++; },
    deleteShader: () => { deletedShaders++; },
  }, { get: (target, property) => Reflect.get(target, property) ?? (() => undefined) });
  class ElementStub extends EventTargetStub {
    children: ElementStub[] = [];
    width = 0; height = 0; hidden = false; className = "";
    clientWidth = 1440;
    style = { setProperty() {}, cursor: "" };
    classList = { add() {}, remove() {}, toggle() {} };
    appendChild(child: ElementStub) { this.children.push(child); return child; }
    get lastChild() { return this.children.at(-1); }
    set innerHTML(_value: string) { this.children = [new ElementStub()]; }
    set textContent(_value: string) { this.children = []; }
    setAttribute() {}
    getContext() { return gl; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 1440, height: 640 }; }
    contains(target: ElementStub): boolean { return target === this || this.children.some(child => child.contains(target)); }
  }
  const stage = new ElementStub();
  const document = Object.assign(new EventTargetStub(), {
    hidden: false, head: new ElementStub(), createElement: () => new ElementStub(), getElementById: () => null,
  });
  const observers: { callback: (entries: { isIntersecting: boolean }[]) => void; disconnected: boolean }[] = [];
  class IntersectionObserverStub {
    disconnected = false;
    constructor(public callback: (entries: { isIntersecting: boolean }[]) => void) { observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const window = Object.assign(new EventTargetStub(), {
    devicePixelRatio: 2, innerWidth: 1440, innerHeight: 900,
    matchMedia: (query: string) => ({ matches: query === "(pointer: coarse)" && coarse }),
    IntersectionObserver: IntersectionObserverStub,
  });
  const testModule = { exports: {} as unknown };
  runInNewContext(source, {
    window, document, module: testModule, IntersectionObserver: IntersectionObserverStub,
    matchMedia: window.matchMedia, performance: { now: () => now },
    requestAnimationFrame: (callback: (time: number) => void) => { frames.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    console: { error() {} },
  });
  const mount = testModule.exports as (stage: ElementStub, options: object) => {
    open(): void; close(): void; destroy(): void; isOpen(): boolean;
  } | null;
  const toggles: boolean[] = [];
  const handle = mount(stage, { cards: [], onToggle: (open: boolean) => toggles.push(open) });
  const canvas = stage.children[0];
  return {
    handle, canvas, document, window, observers, toggles,
    visible(value: boolean) { observers[0].callback([{ isIntersecting: value }]); },
    tick(time: number) { now = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); },
    stats: () => ({ draws, pending: frames.size, released, deletedBuffers, deletedPrograms, deletedShaders }),
  };
}

test("Retina desktops and phones start inside their GPU pixel budgets", () => {
  for (const coarse of [false, true]) {
    const r = renderer({ coarse });
    assert.ok(r.handle);
    assert.ok(r.canvas.width * r.canvas.height <= (coarse ? 200000 : 360000));
    assert.equal(r.stats().draws, 0, "do not draw before the intersection observer confirms visibility");
    r.handle.destroy();
  }
});

test("120 Hz screens are capped at 15 idle / 30 interactive draws per second; cards still open and close", () => {
  const r = renderer();
  r.visible(true);
  for (let frame = 0; frame < 120; frame++) r.tick(frame * 1000 / 120);
  assert.ok(r.stats().draws >= 14 && r.stats().draws <= 16);
  const before = r.stats().draws;
  r.handle!.open();
  for (let frame = 120; frame < 240; frame++) r.tick(frame * 1000 / 120);
  assert.ok(r.stats().draws - before >= 28 && r.stats().draws - before <= 31);
  assert.equal(r.handle!.isOpen(), true);
  assert.ok(r.toggles.includes(true));
  r.handle!.close(); r.tick(2100);
  assert.equal(r.handle!.isOpen(), false);
  assert.equal(r.toggles.at(-1), false);
  r.handle!.destroy();
});

test("hidden/offscreen figures cancel rendering, resume once, and release GPU resources on unmount", () => {
  const r = renderer();
  r.visible(true); r.tick(0);
  r.document.hidden = true; r.document.emit("visibilitychange");
  assert.equal(r.stats().pending, 0);
  const before = r.stats().draws; r.tick(1000);
  assert.equal(r.stats().draws, before);
  r.document.hidden = false; r.document.emit("visibilitychange");
  r.document.emit("visibilitychange");
  assert.equal(r.stats().pending, 1);
  r.visible(false); assert.equal(r.stats().pending, 0);
  r.visible(true); r.tick(2000);
  r.handle!.destroy();
  assert.deepEqual(r.stats(), { draws: before + 1, pending: 0, released: 1, deletedBuffers: 1, deletedPrograms: 1, deletedShaders: 2 });
  assert.ok(r.observers.every(observer => observer.disconnected));
  assert.ok([...r.window.listeners.values(), ...r.document.listeners.values()].every(handlers => handlers.size === 0));
});

test("slow frames reduce the actual capped buffer, not an ineffective pixel ratio", () => {
  const r = renderer(); r.visible(true); r.handle!.open();
  const before = r.canvas.width * r.canvas.height;
  for (let frame = 0; frame < 16; frame++) r.tick(frame * 100);
  assert.ok(r.canvas.width * r.canvas.height < before * 0.75);
  r.handle!.destroy();
});

test("failed shaders release the failed context and context loss stops the loop", () => {
  const failed = renderer({ failShader: true });
  assert.equal(failed.handle, null);
  assert.equal(failed.stats().released, 1);
  assert.equal(failed.stats().deletedShaders, 2);
  const r = renderer(); r.visible(true); r.tick(0);
  r.canvas.emit("webglcontextlost");
  assert.equal(r.stats().pending, 0);
  r.document.emit("visibilitychange");
  assert.equal(r.stats().pending, 0);
  r.handle!.destroy();
});
