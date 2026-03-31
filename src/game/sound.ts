import { createSound } from 'utils-sound';

export type MusicName =
	| 'bgm_main'
	| 'bgm_win';

export type SfxName =
	| 'sfx_wheel_spin'
	| 'sfx_kick'
	| 'sfx_wind_loop'
	| 'sfx_bounce_good'
	| 'sfx_bounce_bad'
	| 'sfx_limb_detach'
	| 'sfx_limb_loosen'
	| 'sfx_spin_bonus'
	| 'sfx_head_catapult'
	| 'sfx_crash_head'
	| 'sfx_crash_stuck'
	| 'sfx_win'
	| 'sfx_win_big'
	| 'sfx_spark';

export type SoundName = MusicName | SfxName;

export const { soundManager } = createSound<SoundName>();
