import winkNLP, { type WinkMethods } from "wink-nlp";
import winkModel from "wink-eng-lite-web-model";
import ffmpeg from "fluent-ffmpeg";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import { ResponseCode, type TTSModule } from "./tts";
import { EffectTypes, MessageTypes, type MessageNode } from "./messageInfo";
import { marked } from "marked";

interface SpeakItOpts {
	ttsModule: TTSModule;
	censor?: boolean;
	spellCheck?: boolean;
}

export default class SpeakIt implements SpeakItOpts {
	nlp: WinkMethods;
	ttsModule: TTSModule;
	censor: boolean;
	spellCheck: boolean;

	constructor({ ttsModule, censor, spellCheck }: SpeakItOpts) {
		this.nlp = winkNLP(winkModel);
		this.ttsModule = ttsModule;
		this.censor = censor ?? false;
		this.spellCheck = spellCheck ?? true;
	}

	parse(text: string) {
		const nodes: MessageNode[] = [];
		// 1. identify any markdown, convert it to a format we can handle
		const tokens = [...marked.lexer(text)];
		let token;
		while ((token = tokens.shift())) {
			switch (token.type) {
				case "paragraph": {
					if (token.tokens) {
						tokens.unshift(...token.tokens);
					}
					break;
				}
				case "blockquote": {
					if (token.tokens) {
						tokens.unshift(...token.tokens);
					}
					break;
				}
				case "text": {
					nodes.push({ type: MessageTypes.TEXT, body: token.text });
					break;
				}
				case "link": {
					if (token.href !== token.text) nodes.push({ type: MessageTypes.TEXT, body: token.text });
					const url = new URL(token.href);
					if (url.protocol === "mailto:") nodes.push({ type: MessageTypes.EMAIL, address: token.href });
					else nodes.push({ type: MessageTypes.LINK, url });
					break;
				}
				case "heading": {
					// todo: emphasis based on heading number? bigger space after?
					nodes.push({ type: MessageTypes.TEXT, body: token.text });
					break;
				}
				case "em": {
					nodes.push({ type: MessageTypes.TEXT_EFFECT, body: token.text, effectType: EffectTypes.EMPHASIS_MODERATE });
					break;
				}
				case "strong": {
					nodes.push({ type: MessageTypes.TEXT_EFFECT, body: token.text, effectType: EffectTypes.EMPHASIS_STRONG });
					break;
				}
				case "del": {
					nodes.push({ type: MessageTypes.TEXT_EFFECT, body: token.text, effectType: EffectTypes.EMPHASIS_REDUCED });
					break;
				}

				// todo: lists

				case "space":
					// todo: pause here?
					break;
				case "br":
					// todo: pause here?
					break;

				case "html":
					throw new Error("Inline html is not allowed");

				default:
					throw new Error(`Unsupported token type: ${token.type}`);
			}
		}

		// todo: (read below)
		// 2. deobfuscate all standard text sections, i.e. emoji lettering or zalgo text
		// 3. if spellCheck, run spellcheck algorithm
		// 4. if censor, run censoring algorithm

		return nodes;
	}

	async speak(text: string): Promise<Buffer> {
		const sections = this.parse(text);

		let nodes: MessageNode[] = [];
		for (const node of sections) {
			if (node.type === MessageTypes.TEXT) {
				// split the text into sentences, each chunk is <= 500 characters
				const chunks: string[] = this.nlp.readDoc(node.body).sentences().out();
				for (let i = 0; i < chunks.length; i++) {
					const chunk = chunks[i];
					if (chunk.length >= 500) {
						const minis = chunk.split(" ");
						let low = Math.floor(minis.length / 2);
						let high = Math.ceil(minis.length / 2);
						if (low == high) {
							high++;
						}
						const first = minis.slice(0, low).join(" ");
						const last = minis.slice(high).join(" ");

						chunks.splice(i, 1, first, last);
						i--;
					}
				}

				for (const chunk of chunks) {
					// remove a period from the end, and
					let txt = chunk.trim();
					if (txt.at(-1) === ".") txt = txt.slice(0, txt.length - 1);
					nodes.push({ type: MessageTypes.TEXT, body: txt });
				}

				continue;
			}

			nodes.push(node);
		}

		const res = await this.ttsModule.speakBulk(nodes);

		if (res.code === ResponseCode.SUCCESS_BULK) {
			const TMP = os.tmpdir();

			const tmps: string[] = [];

			// combine the mp3s into one mp3
			/*
			amovie=${tmpFile}, atempo=${mp3.speed}, volume=${mp3.volume} [a1];
			amovie=${tmpFile} [a2] ;
			[a1] [a2] concat=v=0:a=1
			*/
			const ffmpegInstance = ffmpeg();
			let filters = "";
			let concat = "";
			let i = 0;
			for (const buff of res.buffers) {
				const buffer = buff.buffer;
				// create tmp files
				const tmpFile = `${TMP}/speak-it-${crypto.randomUUID()}.mp3`;
				ffmpegInstance.addInput(tmpFile);
				tmps.push(tmpFile);
				fs.writeFileSync(tmpFile, buffer);

				if (buff.speed == undefined && buff.volume == undefined) {
					concat += `[${i}:a] `;
				} else {
					let line = `[${i}:a] `;
					if (buff.speed != undefined) line += `atempo=${buff.speed}`;
					if (buff.volume != undefined) {
						if (buff.speed) line += ",";
						line += `volume=${buff.volume}`;
					}
					line += ` [ao${i}];`;
					filters += line;
					concat += `[ao${i}] `;
				}
				i++;
			}

			filters += concat + `concat=n=${i}:v=0:a=1`;
			console.log(filters)
			ffmpegInstance.complexFilter(filters);

			const finalFile = `${TMP}/speak-it-final-${crypto.randomUUID()}.mp3`;
			tmps.push(finalFile);
			ffmpegInstance.output(finalFile);

			return new Promise((resolve, reject) => {
				ffmpegInstance.on("end", () => {
					const buff = fs.readFileSync(finalFile);
					for (const file of tmps) {
						fs.unlinkSync(file);
					}
					resolve(buff);
				});
				ffmpegInstance.on("error", (err) => {
					reject(err);
				});

				ffmpegInstance.run();
			});
		}

		throw new Error("Generating audio failed");
	}
}
