import * as PIXI from 'pixi.js';
import type { RobotType, LimbId, LimbState } from '../types';
import { ROBOT_BODY_WIDTH, ROBOT_BODY_HEIGHT } from '../constants';

interface LimbSprite {
	sprite: PIXI.Graphics;
	offsetX: number;
	offsetY: number;
	state: LimbState;
	isLeg: boolean;
}

// Draw a spring/zigzag shape for legs
function drawSpring(g: PIXI.Graphics, width: number, length: number, compression: number, color: number): void {
	const segments = 5;
	const segH = (length * compression) / segments;
	const zigzag = width * 0.7;

	g.clear();
	// Joint circle at top
	g.circle(0, 0, width / 2 + 1);
	g.fill(0x333355);

	// Spring zigzag
	g.moveTo(0, 2);
	for (let i = 0; i < segments; i++) {
		const y1 = 2 + i * segH;
		const y2 = 2 + (i + 0.5) * segH;
		const dir = i % 2 === 0 ? 1 : -1;
		g.lineTo(dir * zigzag, y2);
	}
	g.lineTo(0, 2 + length * compression);
	g.stroke({ width: width * 0.6, color, cap: 'round', join: 'round' });

	// Foot pad at bottom
	g.roundRect(-width * 0.7, 2 + length * compression - 3, width * 1.4, 6, 2);
	g.fill(color);
}

// Draw a straight limb for arms
function drawArm(g: PIXI.Graphics, width: number, length: number, color: number, accentColor: number): void {
	g.clear();
	g.roundRect(-width / 2, 0, width, length, 3);
	g.fill(color);
	g.circle(0, 0, width / 2 + 1);
	g.fill(accentColor);
}

export class Robot {
	public container: PIXI.Container;
	public bodyGroup: PIXI.Container;
	public head: PIXI.Graphics;
	public body: PIXI.Graphics;
	public limbs: Map<LimbId, LimbSprite> = new Map();

	public x = 0;
	public y = 0;
	public rotation = 0;

	private robotType: RobotType;
	private detachedLimbs: PIXI.Container[] = [];
	private bodyColor: number;
	private limbColor: number;
	private legLength: number;
	private legWidth: number;

	// Spring animation
	private springCompression = 1.0; // 1.0 = normal, 0.4 = compressed, 1.2 = extended
	private springTarget = 1.0;
	private springVelocity = 0;

	constructor(type: RobotType, parentContainer: PIXI.Container) {
		this.robotType = type;
		this.container = new PIXI.Container();
		this.bodyGroup = new PIXI.Container();

		this.bodyColor = type === 'tank' ? 0x4a6fa5 : 0xe85d75;
		const accentColor = type === 'tank' ? 0x2c4a7c : 0xb83b5e;
		this.limbColor = type === 'tank' ? 0x5c8cc4 : 0xf08a9e;

		// Body
		this.body = new PIXI.Graphics();
		this.body.roundRect(
			-ROBOT_BODY_WIDTH / 2, -ROBOT_BODY_HEIGHT / 2,
			ROBOT_BODY_WIDTH, ROBOT_BODY_HEIGHT,
			type === 'tank' ? 4 : 8,
		);
		this.body.fill(this.bodyColor);
		this.body.roundRect(
			-ROBOT_BODY_WIDTH / 2 + 4, -ROBOT_BODY_HEIGHT / 2 + 4,
			ROBOT_BODY_WIDTH - 8, ROBOT_BODY_HEIGHT / 3, 2,
		);
		this.body.fill(accentColor);
		this.bodyGroup.addChild(this.body);

		// Head
		this.head = new PIXI.Graphics();
		const headSize = type === 'tank' ? 20 : 16;
		this.head.roundRect(-headSize / 2, -headSize / 2, headSize, headSize, type === 'tank' ? 3 : 6);
		this.head.fill(this.bodyColor);
		if (type === 'tank') {
			this.head.rect(-headSize / 2 + 3, -2, headSize - 6, 6);
			this.head.fill(0x88ccff);
		} else {
			this.head.circle(0, -headSize / 2, 3);
			this.head.fill(0xffdd44);
			this.head.rect(-1, -headSize / 2, 2, -8);
			this.head.fill(0xcccccc);
		}
		this.head.position.set(0, -ROBOT_BODY_HEIGHT / 2 - headSize / 2 - 2);
		this.bodyGroup.addChild(this.head);

		// Limbs
		this.legWidth = type === 'tank' ? 10 : 7;
		this.legLength = type === 'tank' ? 30 : 26;
		const armWidth = type === 'tank' ? 10 : 7;
		const armLength = type === 'tank' ? 26 : 22;

		// Arms (straight)
		const createArm = (id: LimbId, ox: number, oy: number): LimbSprite => {
			const sprite = new PIXI.Graphics();
			drawArm(sprite, armWidth, armLength, this.limbColor, accentColor);
			sprite.position.set(ox, oy);
			this.bodyGroup.addChild(sprite);
			return { sprite, offsetX: ox, offsetY: oy, state: 'intact', isLeg: false };
		};

		// Legs (springs!)
		const createLeg = (id: LimbId, ox: number, oy: number): LimbSprite => {
			const sprite = new PIXI.Graphics();
			drawSpring(sprite, this.legWidth, this.legLength, 1.0, this.limbColor);
			sprite.position.set(ox, oy);
			this.bodyGroup.addChild(sprite);
			return { sprite, offsetX: ox, offsetY: oy, state: 'intact', isLeg: true };
		};

		this.limbs.set('left_arm', createArm('left_arm', -ROBOT_BODY_WIDTH / 2 - armWidth / 2, -ROBOT_BODY_HEIGHT / 4));
		this.limbs.set('right_arm', createArm('right_arm', ROBOT_BODY_WIDTH / 2 + armWidth / 2, -ROBOT_BODY_HEIGHT / 4));
		this.limbs.set('left_leg', createLeg('left_leg', -ROBOT_BODY_WIDTH / 4, ROBOT_BODY_HEIGHT / 2));
		this.limbs.set('right_leg', createLeg('right_leg', ROBOT_BODY_WIDTH / 4, ROBOT_BODY_HEIGHT / 2));

		this.container.addChild(this.bodyGroup);
		parentContainer.addChild(this.container);
	}

	setPosition(x: number, y: number): void {
		this.x = x;
		this.y = y;
		this.container.position.set(x, y);
	}

	setRotation(angle: number): void {
		this.rotation = angle;
		this.bodyGroup.rotation = angle;
	}

	/** Compress springs (call on feet landing). Returns a promise that resolves when spring extends. */
	async compressLegs(): Promise<void> {
		this.springCompression = 0.35;
		this.redrawLegs();

		// Animate spring back
		return new Promise((resolve) => {
			const startTime = performance.now();
			const animate = () => {
				const elapsed = (performance.now() - startTime) / 1000;
				if (elapsed < 0.15) {
					// Stay compressed briefly
					requestAnimationFrame(animate);
				} else if (elapsed < 0.4) {
					// Extend with overshoot
					const t = (elapsed - 0.15) / 0.25;
					this.springCompression = 0.35 + t * 0.85; // back to ~1.2 with overshoot
					if (t > 0.7) this.springCompression = 1.0 + (1 - t) * 0.6; // settle
					this.redrawLegs();
					requestAnimationFrame(animate);
				} else {
					this.springCompression = 1.0;
					this.redrawLegs();
					resolve();
				}
			};
			requestAnimationFrame(animate);
		});
	}

	private redrawLegs(): void {
		for (const [id, limb] of this.limbs) {
			if (limb.isLeg && limb.state !== 'detached') {
				drawSpring(limb.sprite, this.legWidth, this.legLength, this.springCompression, this.limbColor);
			}
		}
	}

	loosenLimb(limbId: LimbId): void {
		const limb = this.limbs.get(limbId);
		if (!limb) return;
		limb.state = 'loosened';
		limb.sprite.tint = 0xffff00;
	}

	detachLimb(limbId: LimbId, parentContainer: PIXI.Container): PIXI.Container | null {
		const limb = this.limbs.get(limbId);
		if (!limb) return null;

		limb.state = 'detached';
		this.bodyGroup.removeChild(limb.sprite);

		const detached = new PIXI.Container();
		const clone = limb.sprite.clone();
		detached.addChild(clone);
		detached.position.set(
			this.x + limb.offsetX * Math.cos(this.rotation),
			this.y + limb.offsetY * Math.sin(this.rotation),
		);

		parentContainer.addChild(detached);
		this.detachedLimbs.push(detached);
		return detached;
	}

	detachHead(parentContainer: PIXI.Container): PIXI.Container {
		this.bodyGroup.removeChild(this.head);
		const detachedHead = new PIXI.Container();
		const headClone = this.head.clone();
		detachedHead.addChild(headClone);
		detachedHead.position.set(this.x, this.y - ROBOT_BODY_HEIGHT / 2);
		parentContainer.addChild(detachedHead);
		return detachedHead;
	}

	detachBody(): void {
		this.body.alpha = 0.3;
	}

	destroy(): void {
		this.container.destroy({ children: true });
		for (const detached of this.detachedLimbs) {
			detached.destroy({ children: true });
		}
		this.detachedLimbs = [];
	}
}
