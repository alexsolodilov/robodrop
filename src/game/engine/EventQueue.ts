import type { BookEvent } from '../typesBookEvent';

export interface QueuedEvent {
	time: number;
	event: BookEvent;
}

export class EventQueue {
	private queue: QueuedEvent[] = [];
	private gameTime = 0;
	private playing = false;
	private resolvers: Map<number, () => void> = new Map();
	private bounceResolvers: Map<number, (event: BookEvent) => void> = new Map();

	loadEvents(events: BookEvent[]): void {
		this.queue = [];
		this.gameTime = 0;
		this.playing = true;

		let time = 0;
		for (const event of events) {
			this.queue.push({ time, event });
			// Events are processed sequentially via bookEventHandlerMap
			// The queue just holds them for frame-driven access
		}
	}

	tick(deltaTime: number): void {
		if (!this.playing) return;
		this.gameTime += deltaTime;
	}

	getGameTime(): number {
		return this.gameTime;
	}

	isPlaying(): boolean {
		return this.playing;
	}

	stop(): void {
		this.playing = false;
		this.resolvers.clear();
		this.bounceResolvers.clear();
	}

	reset(): void {
		this.queue = [];
		this.gameTime = 0;
		this.playing = false;
		this.resolvers.clear();
		this.bounceResolvers.clear();
	}
}
