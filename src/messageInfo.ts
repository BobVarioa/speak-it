

export enum MessageTypes {
	TEXT,
	TEXT_EFFECT,
	LINK,
	EMAIL,
}

export enum EffectTypes {
	EMPHASIS_REDUCED,
	EMPHASIS_MODERATE,
	EMPHASIS_STRONG
}

interface BaseMessageNode {
	type: MessageTypes;
}

export interface TextNode extends BaseMessageNode {
	type: MessageTypes.TEXT;
	body: string;
}


export interface TextEffectNode extends BaseMessageNode {
	type: MessageTypes.TEXT_EFFECT;
	effectType: EffectTypes
	body: string;
}


export interface LinkNode extends BaseMessageNode {
	type: MessageTypes.LINK;
	// note: bun-ism, in a type context this is how you have to get a reference to URL, `URL` refers to the class only
	url: import("url").URL;
}

export interface EmailNode extends BaseMessageNode {
	type: MessageTypes.EMAIL;
	address: string;
}


export type MessageNode = TextNode | LinkNode | EmailNode | TextEffectNode;
