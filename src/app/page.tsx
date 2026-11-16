import { SceneLogApp } from "@/components/scenelog/scenelog-app";
import { movies } from "@/data/movies";

export default function HomePage() { return <SceneLogApp movies={movies} />; }
