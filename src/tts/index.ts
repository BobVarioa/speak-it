import type { MessageNode } from "../messageInfo";

export enum ResponseCode {
	SUCCESS,
	SUCCESS_BULK,
	FAIL,
	RATE_LIMIT
}

interface BaseTTSResponse {
	code: ResponseCode;
}

export interface ErrorTTSResponse extends BaseTTSResponse {
	code: ResponseCode.FAIL;
	message: string;
}

export interface RateLimitTTSResponse extends BaseTTSResponse {
	code: ResponseCode.RATE_LIMIT;
	remainingRequests: number;
	rateLimitReset: number;
}

export interface EffectBuffer {
	volume?: number;
	pitch?: number;
	speed?: number;
	buffer: Buffer;
}

export interface SuccessTTSResponse extends BaseTTSResponse {
	code: ResponseCode.SUCCESS;
	remainingRequests?: number;
	rateLimitReset?: number;
	buffer: EffectBuffer;
}

export interface SuccessBulkTTSResponse extends BaseTTSResponse {
	code: ResponseCode.SUCCESS_BULK;
	remainingRequests?: number;
	rateLimitReset?: number;
	buffers: EffectBuffer[];
}

export type TTSResponse = ErrorTTSResponse | RateLimitTTSResponse | SuccessTTSResponse | SuccessBulkTTSResponse;

export interface TTSModule {
	userAgent: string;
	supportsSSML: boolean;
	
	speak(body: MessageNode): Promise<TTSResponse>;
	speakBulk(body: MessageNode[]): Promise<TTSResponse>;
}