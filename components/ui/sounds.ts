"use client";

const AUDIO_CONTEXT = typeof window !== "undefined" ? new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)() : null;

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.1) {
	if (!AUDIO_CONTEXT) return;
	const oscillator = AUDIO_CONTEXT.createOscillator();
	const gainNode = AUDIO_CONTEXT.createGain();
	oscillator.type = type;
	oscillator.frequency.value = frequency;
	gainNode.gain.value = volume;
	oscillator.connect(gainNode);
	gainNode.connect(AUDIO_CONTEXT.destination);
	oscillator.start();
	oscillator.stop(AUDIO_CONTEXT.currentTime + duration / 1000);
}

export function playMessageSentSound() {
	playTone(800, 100, "sine", 0.15);
	setTimeout(() => playTone(1000, 100, "sine", 0.15), 120);
}

export function playMessageReceivedSound() {
	playTone(600, 150, "sine", 0.2);
	setTimeout(() => playTone(800, 150, "sine", 0.15), 180);
}

export function playNotificationSound() {
	playTone(440, 200, "sine", 0.2);
	setTimeout(() => playTone(660, 200, "sine", 0.15), 220);
}

export function playSuccessSound() {
	playTone(523.25, 100, "sine", 0.2); // C5
	setTimeout(() => playTone(659.25, 100, "sine", 0.2), 120); // E5
	setTimeout(() => playTone(783.99, 100, "sine", 0.2), 240); // G5
}

export function playErrorSound() {
	playTone(300, 300, "sawtooth", 0.2);
	setTimeout(() => playTone(200, 300, "sawtooth", 0.15), 350);
}

export function resumeAudioContext() {
	if (AUDIO_CONTEXT && AUDIO_CONTEXT.state === "suspended") {
		AUDIO_CONTEXT.resume();
	}
}