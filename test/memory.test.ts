import { memory } from "../src/adapters/memory.js";
import { runConformance } from "./conformance.js";

runConformance("memory", () => memory());
