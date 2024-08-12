import SpeakIt from "../src";
import StreamlabsTTS from "../src/tts/streamlabs";
import fs from "node:fs";

const speakIt = new SpeakIt({ ttsModule: new StreamlabsTTS(navigator.userAgent, ["Matthew"]) });

fs.writeFileSync("./out.mp3", await speakIt.speak("The quick brown fox jumped over the lazy dog."));
