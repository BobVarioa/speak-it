import { ResponseCode, type EffectBuffer, type TTSModule, type TTSResponse } from ".";
import { EffectTypes, MessageTypes, type MessageNode } from "../messageInfo";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

async function sleep(ms: number) {
	await new Promise((res) => setTimeout(res, ms));
}


export default class StreamlabsTTS implements TTSModule {
	supportsSSML = true;

	constructor(public userAgent: string, public voices: string[] = ["Matthew", "Kendra", "Joey", "Salli"]) {
	}

	async speak(node: MessageNode): Promise<TTSResponse> {
		const voice = this.voices[Math.floor(Math.random() * this.voices.length)];
		
		if (node.type != MessageTypes.TEXT && node.type != MessageTypes.TEXT_EFFECT) throw new Error("unsupported message type");
		if (node.body.length >= 500) throw new Error("too long");

		// replace spaces with +
		const escapedText = encodeURIComponent(node.body).replaceAll("%20", "+");
		const res = await fetch("https://streamlabs.com/polly/speak", {
			headers: {
				"User-Agent": this.userAgent,
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Accept-Encoding": "gzip, deflate, br",
				"Accept-Language": "en-us,en;q=0.5",
				Referer: "https://streamlabs.com",
			},
			method: "POST",
			body: `voice=${voice}&text=${escapedText}`,
		});

		const remainingRequests = parseInt(res.headers.get("x-ratelimit-remaining")!);
		const rateLimitReset = parseInt(res.headers.get("x-ratelimit-reset")!);

		if (remainingRequests === 0 && rateLimitReset) {
			return {
				code: ResponseCode.RATE_LIMIT,
				remainingRequests,
				rateLimitReset,
			};
		}

		const text = await res.text();
		let resJson;
		try {
			resJson = JSON.parse(text);
		} catch (e) {
			return {
				code: ResponseCode.FAIL,
				message: "Failed to parse response JSON"
			};
		}

		if (resJson.success) {
			const res2 = await fetch(resJson.speak_url, {
				method: "GET",
				headers: {
					"User-Agent": this.userAgent,
					Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					"Accept-Encoding": "gzip, deflate, br",
					"Accept-Language": "en-us,en;q=0.5",
				},
			});

			try {
				let buff: EffectBuffer = { buffer: Buffer.from(await res2.arrayBuffer()) }
				if (node.type === MessageTypes.TEXT_EFFECT) {
					switch (node.effectType) {
						case EffectTypes.EMPHASIS_REDUCED:
							// note: this effect isn't really great? i'm sure there's a way to make this sound way better
							buff.volume = 0.7;
							buff.speed = 1.2;
							break;
						case EffectTypes.EMPHASIS_MODERATE:
							buff.volume = 1.1;
							buff.speed = 0.9;
							break;
						case EffectTypes.EMPHASIS_STRONG:
							buff.volume = 1.2;
							buff.speed = 0.8;
							break;
					}
				}
				return {
					code: ResponseCode.SUCCESS,
					buffer: buff
				}
			} catch (e) {
				return {
					code: ResponseCode.FAIL,
					message: "Failed to download mp3"
				};
			}
		}

		return {
			code: ResponseCode.FAIL,
			message: resJson.message
		};
	}

	async speakBulk(nodes: MessageNode[]): Promise<TTSResponse> {
		let sleepDelay = 15;
		const mp3s = [];

		for (const node of nodes) {
			let mp3 = undefined;

			while (mp3 == undefined) {
				const res = await this.speak(node);

				if (res.code === ResponseCode.RATE_LIMIT) {
					const ms = dayjs.unix(res.rateLimitReset).diff();
					console.info(`Waiting ${Math.ceil(ms / 1000)} seconds for rate limit`);
					await sleep(ms);
					continue;
				}

				if (res.code === ResponseCode.FAIL) {
					console.error(`TTS service failed: ${res.message}, retrying in ${sleepDelay} seconds`);
					await sleep(sleepDelay * 1000);
					sleepDelay *= 2;
					continue;
				}

				if (res.code === ResponseCode.SUCCESS) {
					mp3 = res.buffer;
				}
			}
			
			mp3s.push(mp3);
			if (sleepDelay != 15) sleepDelay /= 2;
		}

		return { code: ResponseCode.SUCCESS_BULK, buffers: mp3s }
	}
}
