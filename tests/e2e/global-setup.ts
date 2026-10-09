import { resetAppData } from "./app";

/** Starts every run with an empty data folder (no recent files or saved settings). */
export default function globalSetup() {
  resetAppData();
}
