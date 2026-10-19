# Camera, staging and captions (`engine/desk.html`)

## Staging

The human stands front-left, nearer the camera; the mascot stands back-right, facing him. The human's resting body
angle (`HU_YAW`) is cheated toward the lens so his face reads in his singles.

**Facing cheat.** That same angle made him look past the mascot in every wide shot ("they are not looking at each
other"). In any shot that holds both characters the page now turns him to the mascot (`HU_YAW_TWO`, 1.95 rad) and,
in the eye-level wides where the camera sits almost behind him, turns the mascot a little further toward him
(`SW_YAW_TWO`, -1.1 rad). The cut hides the change, as in live-action continuity cheats. Test values with
`?huTwo=` and `?swTwo=` on still frames before a full render.

## Shots

| Shot | Use |
|---|---|
| `swFront`, `swLow` | mascot singles |
| `swDutch`, `swDutchR` | mascot reactions and deadpan holds (rolled) |
| `manLow34`, `manCU` | human singles; they follow his head |
| `behindMan` | over his shoulder onto the mascot |
| `wide`, `highWide`, `phoneWide` | two-shots at three heights |
| `insert` | straight down onto the phone feed |

The planner cuts on beats, about every 2 s, never shorter than 0.9 s, puts punchlines on the listener's reaction,
and returns to a wide every few singles. `?debug` prints the plan.

## Captions

- One static phrase at a time, 38 characters at most, breaking on the speaker's pauses (0.38 s) and before joining
  words (to, for, and...).
- A sentence end always starts a new caption, even with no pause; abbreviations ("Dr.", "etc.") and closing quotes
  are handled. Chunks are never merged back across a sentence end.
- "..." marks only a phrase that continues; a new sentence gets none.
- A caption shows 40 ms before its first word and hides when the next one shows, or 0.3 s after its last word.
