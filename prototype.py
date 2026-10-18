#!/usr/bin/env python3
"""Dopanglish prototype.

A terminal-based MVP inspired by the concept document in v1.txt.
The goal is simple: make the instant reward of a correct answer feel explosive.
"""

from __future__ import annotations

import random
import sys
from dataclasses import dataclass
from typing import List


@dataclass
class WordCard:
    word: str
    meaning: str
    distractors: List[str]


WORD_BANK: List[WordCard] = [
    WordCard("abundant", "plentiful", ["dangerous", "boring", "tiny"]),
    WordCard("brilliant", "excellent", ["silent", "slow", "sleepy"]),
    WordCard("rapid", "fast", ["static", "soft", "old"]),
    WordCard("curious", "eager to know", ["angry", "useless", "loud"]),
    WordCard("fragile", "easily broken", ["huge", "hard", "heavy"]),
    WordCard("vivid", "bright and lively", ["weak", "dark", "repetitive"]),
    WordCard("patient", "calm and tolerant", ["short-tempered", "anxious", "quick"]),
    WordCard("ancient", "very old", ["new", "light", "strong"]),
    WordCard("lively", "full of energy", ["boring", "quiet", "calm"]),
    WordCard("chaos", "confusion", ["order", "peace", "success"]),
    WordCard("skillful", "highly capable", ["shy", "poor", "noisy"]),
    WordCard("serene", "calm and peaceful", ["angry", "crowded", "noisy"]),
]


class DopanglishGame:
    def __init__(self) -> None:
        self.score = 0
        self.combo = 0
        self.best_combo = 0
        self.correct_count = 0
        self.mistakes: List[str] = []
        self.review_queue: List[WordCard] = []
        self.question_count = 0
        self.total_questions = 0

    def show_intro(self) -> None:
        print("=" * 54)
        print("      D O P A N G L I S H")
        print("      Learn English. Trigger Chaos.")
        print("=" * 54)
        print("Rules:")
        print("- Answer quickly to keep the combo alive")
        print("- Correct answers trigger a burst effect")
        print("- Mistakes go into the review queue")
        print("- Press q to quit")
        print("=" * 54)

    def burst_effect(self, level: int, word: str) -> None:
        effects = {
            1: ["[ FLASH ]", "* pop *", "+20 XP"],
            2: ["[ GLITCH ]", "// data split //", "+50 XP"],
            3: ["[ OVERDRIVE ]", "BANG!", "+100 XP"],
            4: ["[ DOPA BREAK ]", "SCREEN SHATTERED", "+200 XP"],
        }
        chosen = effects[min(level, 4)]
        for line in chosen:
            print(f"  {line}")
        print(f"  {word} - PERFECT!!")
        print()

    def ask_round(self) -> bool:
        word = random.choice(WORD_BANK)
        self.question_count += 1
        self.total_questions += 1

        choices = [word.meaning]
        choices.extend(random.sample(word.distractors, 3))
        random.shuffle(choices)

        print(f"\nQuestion #{self.question_count}")
        print(f"Score: {self.score} | Combo: x{self.combo} | Correct: {self.correct_count}")
        print("=" * 36)
        print(f"What does '{word.word}' mean?")
        for idx, option in enumerate(choices, 1):
            print(f"  {idx}. {option}")
        print("=" * 36)

        while True:
            answer = input("Select 1-4 or q: ").strip().lower()
            if answer == "q":
                return False
            if answer not in {"1", "2", "3", "4"}:
                print("  Please enter a number from 1 to 4.")
                continue
            selected = choices[int(answer) - 1]
            break

        if selected == word.meaning:
            self.correct_count += 1
            self.combo += 1
            self.best_combo = max(self.best_combo, self.combo)
            self.score += 100 + (self.combo * 25)
            self._celebrate(word)
            print(f"Right! {word.word} = {word.meaning}")
            return True

        self.combo = 0
        self.mistakes.append(word.word)
        self.review_queue.append(word)
        print(f"Wrong. The correct answer was: {word.meaning}")
        print("  The screen glitched... but the next round is ready.")
        return True

    def _celebrate(self, word: WordCard) -> None:
        level = 1
        if self.combo >= 3:
            level = 2
        if self.combo >= 5:
            level = 3
        if self.combo >= 8:
            level = 4
        self.burst_effect(level, word.word)

    def show_summary(self) -> None:
        print("\n" + "=" * 54)
        print("             SESSION RESULT")
        print("=" * 54)
        print(f"Total questions : {self.total_questions}")
        print(f"Correct answers : {self.correct_count}")
        print(f"Score           : {self.score}")
        print(f"Best combo     : x{self.best_combo}")
        print(f"Mistakes       : {len(self.mistakes)}")
        if self.mistakes:
            print("Review queue   : " + ", ".join(self.mistakes[:5]))
        print("=" * 54)

    def review_mistakes(self) -> None:
        if not self.review_queue:
            print("No mistakes yet. The game is clean.")
            return

        print("\nReview mode: mistakes will be re-tested.")
        for item in self.review_queue[:5]:
            print(f"- {item.word} -> {item.meaning}")

        answer = input("Start review? (y/n): ").strip().lower()
        if answer != "y":
            return

        for item in self.review_queue[:5]:
            options = [item.meaning]
            options.extend(random.sample([card.meaning for card in WORD_BANK if card.word != item.word], 3))
            random.shuffle(options)
            print(f"\nWhat does '{item.word}' mean?")
            for idx, choice in enumerate(options, 1):
                print(f"  {idx}. {choice}")
            pick = input("Select 1-4: ").strip()
            if pick not in {"1", "2", "3", "4"}:
                print(f"  Skip. Correct answer: {item.meaning}")
                continue
            if options[int(pick) - 1] == item.meaning:
                print("  Perfect recall! You locked it in.")
            else:
                print(f"  Not this time. Correct answer: {item.meaning}")


def main() -> None:
    while True:
        game = DopanglishGame()
        game.show_intro()
        input("Press Enter to start: ")

        while True:
            keep_playing = game.ask_round()
            if not keep_playing:
                break
            if game.question_count >= 10:
                print("\nStage clear! The screen is overclocked.")
                break

        game.show_summary()
        game.review_mistakes()

        reply = input("\nPlay again? (y/n): ").strip().lower()
        if reply != "y":
            print("Dopanglish finished. See you next round.")
            break


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted. Session ended.")
        sys.exit(0)
    except EOFError:
        print("\nInput ended. Session closed.")
        sys.exit(0)
