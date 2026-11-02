# VoxTree — Master Lesson Scripts + LTX Shot Pack

**Built:** Mon Nov 2, 2026. **Status:** Production input pack — LOCAL DOCUMENT ONLY. Nothing pushed, posted, rendered, or recorded yet.
**Serves:** Pilot launch Sat Nov 28, 2026 ($29.99/month) · Week 3 demo Nov 13–19 · Pipeline Blueprint (`voxtree-pipeline-blueprint-ltx-comfyui-seedvc-2026-11-02.md`, PR #48) · Style Decision (locked Oct 29, 2026).

## Why this pack exists

SeedVC is voice **conversion**, not text-to-speech. Every VoxTree lesson therefore needs two things made **once**, by us, before any family is involved: (1) a **human source performance** — one reader performing the lesson script aloud — which SeedVC later converts into each family's adult voice, inheriting that performance's timing, warmth, and prosody; and (2) a **master video** — LTX Studio shots of a generic grandparent reading in a chair — which ComfyUI later restyles per family around their approved character keyframes. This pack is the production input for both: ten original lesson scripts written to be *read aloud as the source performance* (they become each content row's `textScript`, and their recordings become `isolatedVocalsUrl`), plus a paste-ready LTX Studio prompt for every shot of every lesson (the renders become `originalVideoUrl`). A producer can open this document in LTX Studio and a recording session and start work with no other document.

**Locked style (Style Decision, Oct 29):** a Pixar-style clone of the adult, present **in a chair reading for the whole video**; the voice is their real, authentic cloned voice. Framing language everywhere: *"a storybook version of you"* — never "a digital you," never photoreal.

---

# PART 1 — GLOBAL LTX SECTION (define once, reuse verbatim)

## 1.1 Technical settings (from the Blueprint §1 format contracts + §4 shot structure)

| Setting | Value | Source |
|---|---|---|
| Master shot format | MP4 (H.264), silent (audio is added at assembly) | Blueprint §1 |
| Generation resolution | **720p** (1280×720, 16:9) — delivery upsamples to 1080p later | Blueprint §1, §5 |
| Frame rate | **24 fps** | Blueprint §1 |
| Per-shot duration | **4–10 s** (frame counts 8n+1: 97 / 121 / 193 frames typical) | Blueprint §1, §4 |
| Shot count per lesson | **14 shots** | Blueprint §4 |
| Shot pattern | 5 medium hero · 3 close · 2 wide · 2 book-page cutaways · 2 lesson-visual cutaways | Blueprint §4 |
| Cuts | On **sentence boundaries** only; audio is the continuous master clock, video conforms to audio | Blueprint §4 |
| Identity anchoring | Keyframes, not prompts — masters use the generic Element below; family renders condition on 3 family-approved keyframes | Blueprint §4, §5 |
| Attempts budget | ~3 takes per shot in Studio; pick the best | Blueprint §2 |

## 1.2 Master Elements (create these in LTX Studio first; paste verbatim)

**EL-GRANDPARENT — the generic master grandparent (character Element):**
> Warm storybook grandparent, about seventy years old, round friendly face, soft silver hair in a low bun, kind crinkled eyes behind round amber glasses, gentle smile lines, wearing a rust-red knitted cardigan over a cream blouse, small gold heart necklace, hands expressive and calm, Pixar-style 3D character, clearly a generic placeholder grandparent who does not resemble any real person

**EL-CHAIR — the reading chair (prop Element, used with EL-GRANDPARENT in every face shot):**
> Oversized cozy reading armchair in deep teal velvet, high back, rolled arms, a folded mustard-yellow knit blanket over one arm, a small round side table beside it holding a mug of tea and a reading lamp with a warm glowing shade

**EL-ROOM — the reading room (location Element):**
> Cozy storybook reading room at golden hour, tall wooden bookshelves filled with colorful book spines, a round woven rug, a window with soft warm light and floating dust motes, a small potted plant, framed children's drawings on the wall, warm amber and teal palette

**EL-BOOK — the big storybook (prop Element):**
> One very large storybook with thick cream pages and big colorful illustrations, a deep green cloth cover with gold leaf corners, pages that turn slowly and smoothly, large enough to rest open on a lap and be read by the camera

**Element rules:** Every face-shot prompt references EL-GRANDPARENT + EL-CHAIR + EL-ROOM; every book shot references EL-BOOK. Never rename, redescribe, or "improve" an Element mid-lesson or mid-series — consistency comes from the Elements, not from re-describing. The master grandparent is deliberately generic and neutral: prompts in this pack **never describe a specific real person**, and no customer photo or voice ever enters LTX Studio (Blueprint §1 design rule).

## 1.3 Global style string (appended verbatim to EVERY shot prompt below)

> **STYLE:** Pixar-style 3D animation, soft subsurface skin, warm golden-hour light, gentle depth of field, slow smooth 35mm-feel camera, cozy storybook color palette, tender expressive character acting, clean composition, 16:9

In the shot tables, each prompt is written as: `[Element refs + shot action/camera] + STYLE`. Paste the full STYLE text after the action text when generating — it is printed in full in every row's instruction and abbreviated as **+STYLE** in the tables only to keep them readable. When in doubt, paste more, not less: dropping the style string is the fastest way to get drift between shots.

## 1.4 Negative prompt (paste into every generation's negative / avoid field)

> photorealistic, live action, uncanny, distorted hands, extra fingers, warped face, flickering, morphing features, changing clothes, changing hairstyle, text artifacts, watermark, logo, scary, dark shadows, harsh light, fast camera movement, jitter, blurry face, duplicate character, second person

## 1.5 Consistency + keyframe rules (Blueprint §4–§5, applied to masters)

1. Same Elements, same STYLE string, same seed family per lesson. Change the action line and camera line only.
2. Face shots are always: character **in the chair**. Cutaways (book pages, lesson visuals) are the only face-free shots — 4 of 14, at section breaks, exactly as the Blueprint's pattern places them.
3. Masters are the performance reference: the V2V personalization inherits the master's head motion, gestures, and mouth timing, so pick takes where the grandparent's acting is clear and unhurried — big, kind, readable.
4. After a family's keyframes are approved (Blueprint gate B2), family renders condition on those keyframes — the prompts in this pack are for the **master** only and are never re-run with a real person's description.
5. If a shot needs a re-roll, re-roll the face shot, not the cutaway (Blueprint §4: page-turn cutaways absorb edit points).

## 1.6 How each lesson maps to the repo (content_library)

| Pack piece | Schema field |
|---|---|
| Narration script (Part 2, numbered sentences) | `textScript` |
| Human recording of that exact script (isolated vocals, no music) | `isolatedVocalsUrl` |
| Instrumental bed per the lesson's Music Bed direction (licensed/royalty-free, consistent series sound) | `instrumentalUrl` |
| Assembled master video (14 LTX shots + source vocals + bed) | `originalVideoUrl` |
| Row mode | `contentMode = 'tts'` (legacy name; semantically *source-vocal conversion mode* — Blueprint §1) |

---

# PART 2 — THE TEN MASTER LESSONS

**How to read each lesson block:** Header (metadata + content mapping) → Narration script (numbered sentences; **[pause]** = hold a full 2 counts of warm silence for the child to answer — SeedVC converts the performance, pauses included) → Shot table (Blueprint §4 pattern: 5 medium hero, 3 close, 2 wide, 2 book-page cutaways, 2 lesson-visual cutaways; seconds sum to ≈112 s of shots + 8 s title/end card ≈ 2:00) → Music bed → Source-performance notes.

**Prompt convention in every table:** `EL-GRANDPARENT / EL-CHAIR / EL-ROOM / EL-BOOK` = attach those Elements; **+STYLE** = append the §1.3 style string verbatim; negative prompt is always §1.4.

---

## Lesson 1 — The Alphabet

**Age band:** 2–5 · **Target runtime:** ~2:00 · **Learning goal:** Recognize all 26 letter names, each anchored to one concrete, lovable word.
**Content mapping:** script → `textScript`; source recording → `isolatedVocalsUrl`; bed → `instrumentalUrl`; master → `originalVideoUrl`; `contentMode='tts'`.
**Script length:** 251 words · 31 numbered sentences (spoken text counted, [pause] markers excluded).

### Narration script (read aloud exactly as written)

> S1. Hello, my love — come sit with me. It's time for letters!
> S2. Letters are the little shapes that build every word you love.
> S3. Are you ready? Let's go slowly, together.
> S4. A is for apple, crunchy and red.
> S5. B is for ball, bouncing high.
> S6. C is for cat, soft and sleepy.
> S7. D is for dog, happy and wagging.
> S8. E is for egg, round and smooth.
> S9. F is for fish, swimming, swimming.
> S10. G is for grapes, purple and sweet.
> S11. H is for hat, sitting on top.
> S12. I is for ice, cold and shiny.
> S13. J is for jump — jump with me! [pause]
> S14. K is for kite, dancing in the wind.
> S15. L is for lion, brave and loud — roar! [pause]
> S16. M is for moon, glowing at night.
> S17. N is for nose, right on your face — boop!
> S18. O is for orange, juicy and bright.
> S19. P is for pig, pink and giggly.
> S20. Q is for queen, wearing a crown.
> S21. R is for rain, tapping the window.
> S22. S is for sun, warm on your cheeks.
> S23. T is for tree, tall and strong — that's our tree!
> S24. U is for umbrella, keeping you dry.
> S25. V is for violin, singing a song.
> S26. W is for water, splash and play.
> S27. X is for fox — see how the X hides at the end!
> S28. Y is for yellow, cheerful and sunny.
> S29. Z is for zebra, stripy and proud.
> S30. You did it! A, B, C — all the way to Z!
> S31. Now we know our ABCs — and we learned them together.

### Shot table

| # | Type | Sent. | Sec | LTX prompt (Elements + action/camera) +STYLE | Overlay |
|---|---|---|---|---|---|
| 1 | Wide | S1–S2 | 8 | EL-ROOM + EL-CHAIR + EL-GRANDPARENT waving hello from the chair, EL-BOOK closed on lap; slow push-in from the window side +STYLE | Title: "The Alphabet" |
| 2 | Medium hero | S3–S5 | 10 | EL-GRANDPARENT in EL-CHAIR opens EL-BOOK, leans in with a conspiratorial smile, taps the first page; steady medium shot +STYLE | A · B big letters |
| 3 | Cutaway — lesson visual | S6–S8 | 8 | EL-BOOK page close: a sleepy cat, a wagging dog, a smooth egg illustrated in storybook style; page corner lifts slightly +STYLE | C · D · E |
| 4 | Medium hero | S9–S11 | 10 | EL-GRANDPARENT mimes swimming hands, then pretends to pop a hat on her head, laughing; medium shot +STYLE | F · G · H |
| 5 | Close | S12–S13 | 7 | Close on EL-GRANDPARENT's delighted face, she points at the camera — "jump with me" — small bounce in the chair; gentle handheld feel +STYLE | I · J |
| 6 | Cutaway — book page | S14–S15 | 6 | EL-BOOK page turn in close view, new page shows a kite in wind and a lion mid-roar; page settles +STYLE | K · L |
| 7 | Medium hero | S16–S18 | 10 | EL-GRANDPARENT gazes up dreamily at an imaginary moon, then boops the air toward camera, giggling; medium shot +STYLE | M · N · O |
| 8 | Medium hero | S19–S21 | 9 | EL-GRANDPARENT oinks softly with a scrunched nose, then mimes a crown, then listens to imaginary rain, fingers tapping; medium shot +STYLE | P · Q · R |
| 9 | Cutaway — lesson visual | S22–S23 | 8 | Sunbeams through EL-ROOM window, then the illustrated tree page in EL-BOOK, branches swaying gently +STYLE | S · T |
| 10 | Medium hero | S24–S26 | 10 | EL-GRANDPARENT mimes holding an umbrella, then plays an invisible violin with great seriousness, then splashes playfully; medium shot +STYLE | U · V · W |
| 11 | Close | S27–S29 | 8 | Close: EL-GRANDPARENT whispers the fox secret with a wink, then beams at yellow and zebra, proud; slow push-in +STYLE | X · Y · Z |
| 12 | Cutaway — book page | S30 | 5 | EL-BOOK final alphabet page, all 26 letters in a colorful arc; a soft golden glow passes over them +STYLE | A–Z arc |
| 13 | Close | S31 | 9 | Close: EL-GRANDPARENT closes EL-BOOK halfway, hand on heart, warm and proud, nodding at camera; gentle push-in +STYLE | — |
| 14 | Wide | — (outro) | 7 | Wide of EL-ROOM: EL-GRANDPARENT waves goodbye from EL-CHAIR, lamp glow warmer, slow pull-back +STYLE | End card: "Made with AI + family permission" |

**Shot seconds total:** 115 s + 5 s title card ≈ 2:00.

**Music bed:** Gentle music-box and soft piano, major key, ~92 BPM, a simple repeating melody a toddler can predict; sparkle chime on each new letter group if the track allows stems. No vocals.

**Source-performance notes:** Bright and bouncy, smiling in the voice throughout. Keep the letter lines metronome-steady — toddlers chant along — but swell on S13 (jump) and S15 (roar): bigger, sillier, then straight back to warm. Full 2-count pauses after both [pause] markers. S27 (fox/X) goes conspiratorial-whisper; S30–S31 land proud and slow.

---

## Lesson 2 — Counting 1 to 10

**Age band:** 2–5 · **Target runtime:** ~2:00 · **Learning goal:** Count 1–10 in order, one-to-one, with objects to touch with the eyes.
**Content mapping:** as Lesson 1 (`textScript` / `isolatedVocalsUrl` / `instrumentalUrl` / `originalVideoUrl`, `contentMode='tts'`).
**Script length:** 252 words · 19 numbered sentences (spoken text counted, [pause] markers excluded).

### Narration script

> S1. Hello, my clever counter! Today we are counting — all the way up to ten.
> S2. Counting tells us how many of something there are. Ready to find out how many?
> S3. One — one cozy chair, the very best chair, just for reading together. [pause]
> S4. Two — two kind eyes, looking right at you, and they think you're wonderful.
> S5. Three — three little books, waiting patiently on the shelf for their turn.
> S6. Four — four soft paws on one very sleepy, very round cat. [pause]
> S7. Five — five fingers on one hand. Hold yours up and wiggle them with me!
> S8. Six — six round oranges, piled high in a bowl, smelling like sunshine.
> S9. Seven — seven bright stars, twinkling high above the quiet rooftops.
> S10. Eight — eight brand-new crayons, every color of the rainbow, ready to draw. [pause]
> S11. Nine — nine soap bubbles, floating up, up, up into the blue.
> S12. Ten — ten toes! Ten wiggly, wonderful, ticklish toes at the ends of your feet!
> S13. Now let's whisper the numbers, soft as falling snow: one, two, three, four, five.
> S14. Six, seven, eight, nine, ten — quiet as a secret between us. [pause]
> S15. Now let's shout them, big as the whole sky: one, two, three!
> S16. Four, five, six, seven — louder, I can hardly hear you!
> S17. Eight, nine, TEN — we made it all the way! [pause]
> S18. You counted all the way to ten, and you did it all by yourself.
> S19. Numbers are hiding everywhere in this world, my love — and now you know how to find them.

### Shot table

| # | Type | Sent. | Sec | LTX prompt +STYLE | Overlay |
|---|---|---|---|---|---|
| 1 | Wide | S1–S2 | 8 | EL-ROOM + EL-CHAIR + EL-GRANDPARENT beckoning warmly, EL-BOOK on lap, counting on her fingers to camera; slow push-in +STYLE | Title: "Counting 1 to 10" |
| 2 | Medium hero | S3–S4 | 10 | EL-GRANDPARENT pats EL-CHAIR ("one"), then points to her two eyes with a smile; medium shot +STYLE | 1 · 2 |
| 3 | Cutaway — lesson visual | S5–S6 | 8 | Three storybooks on the EL-ROOM shelf glow softly one by one, then a sleepy illustrated cat shows four paws +STYLE | 3 · 4 |
| 4 | Close | S7 | 7 | Close on EL-GRANDPARENT's hand rising into frame, five fingers wiggling playfully, her laughing face behind +STYLE | 5 |
| 5 | Medium hero | S8–S9 | 10 | EL-GRANDPARENT mimes counting oranges into a bowl, then points up as stars appear above EL-ROOM window; medium shot +STYLE | 6 · 7 |
| 6 | Cutaway — book page | S10 | 6 | EL-BOOK page turn: a rainbow box of eight crayons illustrated, colors vivid; page settles +STYLE | 8 |
| 7 | Medium hero | S11–S12 | 10 | EL-GRANDPARENT blows imaginary bubbles upward, watching them float, then reaches down to wiggle imaginary toes, delighted +STYLE | 9 · 10 |
| 8 | Close | S13–S14 | 8 | Close: EL-GRANDPARENT whispers the count, finger to lips, eyes twinkling, counting softly on fingers +STYLE | 1–5, then 6–10, small |
| 9 | Medium hero | S15–S16 | 9 | EL-GRANDPARENT throws hands wide, big joyful counting to the ceiling, rocking with energy; medium shot +STYLE | 1 · 2 · 3 … 7 |
| 10 | Close | S17 | 7 | Tight close: EL-GRANDPARENT shouts "TEN!" with arms raised, pure celebration, then laughs +STYLE | 10! |
| 11 | Cutaway — lesson visual | S18 | 8 | EL-BOOK page: numbers 1–10 in a rising staircase of storybook blocks, a small star lands on 10 +STYLE | 1→10 staircase |
| 12 | Cutaway — book page | — | 5 | EL-BOOK page turn back to the first page, candle-warm light, a bookmark slides in +STYLE | — |
| 13 | Medium hero | S19 | 9 | EL-GRANDPARENT gestures around EL-ROOM as if numbers hide everywhere, then touches her heart; medium shot +STYLE | — |
| 14 | Wide | — (outro) | 7 | Wide EL-ROOM, EL-GRANDPARENT waves from EL-CHAIR under the lamp glow, slow pull-back +STYLE | End card: "Made with AI + family permission" |

**Shot seconds total:** 112 s + title/end cards ≈ 2:00.

**Music bed:** Soft pizzicato strings and a gentle xylophone, ~96 BPM, each number landing on a plucked note feel; whisper section arrangement thins to solo music box, shout section adds a happy hand-drum. No vocals.

**Source-performance notes:** This script lives on dynamics: count lines steady and clear (toddlers count along), S13–S14 at a true whisper — lean into the mic — then S15–S17 genuinely big and joyful, but never shout-y harsh. 2-count pauses on every [pause]; the final TEN gets a full beat of silence before S18 so the warmth lands.

---

## Lesson 3 — Colors All Around

**Age band:** 2–6 · **Target runtime:** ~2:00 · **Learning goal:** Name six core colors (red, blue, yellow, green, orange, purple) and hunt for them in the everyday world.
**Content mapping:** as Lesson 1.
**Script length:** 247 words · 16 numbered sentences (spoken text counted, [pause] markers excluded).

### Narration script

> S1. Come close, my love, and open your eyes wide — today we are hunting for colors!
> S2. Colors hide absolutely everywhere in the world. You just have to know how to look.
> S3. Red! Red like a shiny apple on the tree. Red like my cardigan. Can you find something red near you? [pause]
> S4. Blue! Blue like the big, wide, endless sky. Blue like a sleepy little bluebird on a branch.
> S5. Yellow! Yellow like the warm, warm morning sun. Yellow like a banana — peel it, yum!
> S6. Green! Green like the cool grass under your bare toes. Green like a frog — ribbit, ribbit! [pause]
> S7. Orange! Orange like a fat pumpkin waiting in the patch. Orange like the sky when the sun says goodnight.
> S8. Purple! Purple like a bunch of sweet, juicy grapes. Purple like the crown of a kind and gentle queen.
> S9. Now, let's mix it all up and play. What color is the sun, shining up high? [pause]
> S10. Yellow! Yes! Yes! You remembered — you are so clever!
> S11. And what color is the sky on a bright, sunny day? Think hard now. [pause]
> S12. Blue! That's right, my clever one. You really, truly know your colors.
> S13. Red apple, blue sky, yellow sun — say them with me, one more time.
> S14. Green grass, orange pumpkin, purple grapes — all the colors, all together.
> S15. The whole world is a rainbow that forgot to line up in a row.
> S16. And you — you are my favorite color of all: the warm color of somebody loved.

### Shot table

| # | Type | Sent. | Sec | LTX prompt +STYLE | Overlay |
|---|---|---|---|---|---|
| 1 | Wide | S1–S2 | 8 | EL-ROOM washed in rainbow window light, EL-GRANDPARENT in EL-CHAIR gestures at the colorful room, inviting; slow push-in +STYLE | Title: "Colors All Around" |
| 2 | Medium hero | S3 | 10 | EL-GRANDPARENT holds up an illustrated apple from EL-BOOK, then tugs her red cardigan proudly; medium shot +STYLE | RED |
| 3 | Cutaway — lesson visual | S4 | 8 | Out the EL-ROOM window: storybook blue sky, a small bluebird swoops and lands on the sill +STYLE | BLUE |
| 4 | Medium hero | S5 | 10 | EL-GRANDPARENT raises her face to imaginary sunshine, then peels an imaginary banana with a grin; medium shot +STYLE | YELLOW |
| 5 | Cutaway — book page | S6 | 6 | EL-BOOK page turn: green meadow illustration, a frog hops once and croaks; page settles +STYLE | GREEN |
| 6 | Medium hero | S7–S8 | 10 | EL-GRANDPARENT hefts an imaginary heavy pumpkin, wobbling comically, then regally mimes a crown; medium shot +STYLE | ORANGE · PURPLE |
| 7 | Close | S9 | 7 | Close: EL-GRANDPARENT's quiz face — raised eyebrow, finger up, playful suspense +STYLE | "What color is the sun?" |
| 8 | Close | S10 | 7 | Close: her face bursts into delighted celebration, clapping once +STYLE | YELLOW! |
| 9 | Medium hero | S11–S12 | 9 | EL-GRANDPARENT asks again, pointing up, then applauds the answer warmly; medium shot +STYLE | BLUE! |
| 10 | Cutaway — lesson visual | S13–S14 | 8 | A storybook spread sweeps across EL-BOOK: apple, sky, sun, grass, pumpkin, grapes light up in sequence +STYLE | six color words |
| 11 | Cutaway — book page | S15 | 5 | EL-BOOK page: a jumbled rainbow arcs crookedly over the reading room illustration, charming and imperfect +STYLE | — |
| 12 | Close | S16 | 8 | Tight close: EL-GRANDPARENT's softest expression, hands folded over her heart, direct warm eye contact +STYLE | — |
| 13 | Medium hero | — (beat) | 9 | EL-GRANDPARENT opens her arms in a big imaginary hug toward camera, holding it; medium shot +STYLE | — |
| 14 | Wide | — (outro) | 7 | Wide EL-ROOM at golden hour, colors rich, EL-GRANDPARENT waves from EL-CHAIR; slow pull-back +STYLE | End card: "Made with AI + family permission" |

**Shot seconds total:** 112 s + cards ≈ 2:00.

**Music bed:** Bright felt piano + ukulele strums, ~100 BPM, each color section opens with a soft marimba note in a matching "mood" (producer's choice); quiz section drops to a playful tick-tock pizzicato. No vocals.

**Source-performance notes:** Each color name is an event — announce it, don't list it: hit S3–S8 color words with a little trumpet in the voice, then soften for the examples. Quiz questions (S9, S11) get real suspense: slow down, rise at the end, and honor the full 2-count pause before celebrating. S15–S16 slow right down; S16 is the emotional button of the whole lesson — say it like you mean it, because the conversion will carry exactly that.

---

## Lesson 4 — Shapes in Our World

**Age band:** 2–6 · **Target runtime:** ~2:00 · **Learning goal:** Name and spot circle, square, triangle, rectangle, star, and heart in everyday objects.
**Content mapping:** as Lesson 1.
**Script length:** 259 words · 16 numbered sentences (spoken text counted, [pause] markers excluded).

### Narration script

> S1. Look around, my love — the whole wide world is quietly full of shapes!
> S2. Everywhere you look, shapes are hiding in plain sight. Let's go and find them together.
> S3. A circle is round and round and round — with no corners anywhere at all.
> S4. The sun is a circle, high in the sky. A cookie is a circle, too. Can you draw one in the air? [pause]
> S5. A square has four straight sides, all exactly the same — count them: one, two, three, four!
> S6. A window is a square, looking out at the day. A cracker is a square — crunch, crunch!
> S7. A triangle points up to the sky, with three proud corners — one, two, three.
> S8. A mountain is a great big triangle. And a slice of cheesy pizza is a delicious triangle. [pause]
> S9. A rectangle is long and tall, like a friendly door that says, "Come in, come in!"
> S10. Your own book is a rectangle. And a bus, rolling down the street, is a rectangle too.
> S11. A star twinkles with five bright points — count them slowly with me: one, two, three, four, five! [pause]
> S12. And a heart? A heart is a shape all of its own — the shape of love itself.
> S13. My heart makes exactly that shape every single time I think of you.
> S14. Circle, square, triangle. Rectangle, star, and heart — say them all with me now.
> S15. Now your eyes know the secret the world was keeping: shapes are absolutely everywhere.
> S16. Go and find one today, somewhere out there — and then tell me all about it.

### Shot table

| # | Type | Sent. | Sec | LTX prompt +STYLE | Overlay |
|---|---|---|---|---|---|
| 1 | Wide | S1–S2 | 8 | EL-ROOM full of softly glowing shape outlines hidden in objects, EL-GRANDPARENT in EL-CHAIR inviting camera to hunt; slow push-in +STYLE | Title: "Shapes in Our World" |
| 2 | Medium hero | S3–S4 | 10 | EL-GRANDPARENT draws a big circle in the air with both hands, then frames an imaginary sun; medium shot +STYLE | CIRCLE |
| 3 | Cutaway — lesson visual | S4 | 8 | Storybook sun and a cookie on a plate in EL-BOOK illustration, a golden circle outline traces around each +STYLE | ○ |
| 4 | Medium hero | S5–S6 | 10 | EL-GRANDPARENT traces a square in the air counting corners on fingers, then mimes an crunchy bite; medium shot +STYLE | SQUARE |
| 5 | Cutaway — book page | S7–S8 | 6 | EL-BOOK page turn: a mountain peak and a pizza slice, a triangular outline traces each +STYLE | TRIANGLE |
| 6 | Medium hero | S9–S10 | 9 | EL-GRANDPARENT mimes opening a tall door with a grand welcome, then drives an imaginary bus past; medium shot +STYLE | RECTANGLE |
| 7 | Close | S11 | 8 | Close: EL-GRANDPARENT counts five star points on her spread fingers, one by one, eyes bright +STYLE | STAR ★ 1-2-3-4-5 |
| 8 | Cutaway — lesson visual | S12 | 8 | A soft glowing heart illustration fills EL-BOOK's page, pulsing gently like a heartbeat +STYLE | HEART ♥ |
| 9 | Close | S13 | 7 | Close: EL-GRANDPARENT's hand over her heart, tender expression, speaking straight to camera +STYLE | — |
| 10 | Medium hero | S14 | 10 | EL-GRANDPARENT recaps, shaping each form in the air in rhythm — circle, square, triangle, rectangle, star, heart; medium shot +STYLE | six shapes in a row |
| 11 | Cutaway — book page | S15 | 5 | EL-BOOK page: the reading room redrawn with every object outlined in its shape, a treasure-map feel +STYLE | — |
| 12 | Medium hero | S16 | 9 | EL-GRANDPARENT points out toward the viewer's world, encouraging, then winks; medium shot +STYLE | — |
| 13 | Close | — (beat) | 7 | Close: EL-GRANDPARENT blows a small kiss to camera, smiling +STYLE | — |
| 14 | Wide | — (outro) | 7 | Wide EL-ROOM, lamp warm, EL-GRANDPARENT waves from EL-CHAIR; slow pull-back +STYLE | End card: "Made with AI + family permission" |

**Shot seconds total:** 112 s + cards ≈ 2:00.

**Music bed:** Playful clarinet + piano, ~98 BPM, with a soft "boing"-free, all-acoustic feel; each new shape gets a single bright glockenspiel note. The heart section thins to solo piano. No vocals.

**Source-performance notes:** Count the square's sides and the star's points out loud, slowly, tapping each number — children count on fingers here. S4's air-circle question needs its full pause; keep your own voice drawing the circle (rising, round intonation). Shift gear completely at S12: slower, softer, sincere — the lesson's heart moment — then rebuild energy for the S14 recap chant.

---

## Lesson 5 — Kind Words

**Age band:** 3–8 · **Target runtime:** ~2:00 · **Learning goal:** Feel how kind words, helping, and sharing change a moment — and practice saying them.
**Content mapping:** as Lesson 1.
**Script length:** 241 words · 17 numbered sentences (spoken text counted, [pause] markers excluded).

### Narration script

> S1. Today, my love, we are going to talk about something stronger than muscles and bigger than shouting.
> S2. Words. Your words can build a bridge between two people — or knock a bridge down.
> S3. Kind words are like warm sunshine that you can say out loud to somebody.
> S4. When you say, "You can do it," somebody stands a little taller inside themselves.
> S5. Try it with me now, nice and strong: You can do it! [pause]
> S6. When a friend falls down, kind hands — your hands — can help them back up again.
> S7. You don't need to be big or strong to help. You just need to notice somebody needs you.
> S8. Sharing is kindness that your hands can do, even before your words wake up.
> S9. Half a cookie, shared with love, tastes sweeter than a whole cookie eaten all alone.
> S10. Say, "Would you like some?" Go on, try it out loud: [pause]
> S11. And when someone you love is sad, you don't have to fix the sad all by yourself.
> S12. Sitting close, staying near, and saying, "I'm here," is a kind of quiet magic.
> S13. Say it very softly now, like a secret: I'm here. [pause]
> S14. Kind words cost absolutely nothing — and somehow they are worth absolutely everything.
> S15. Every single day, you will get brand-new chances to be somebody's sunshine.
> S16. And oh, my love, I see that sunshine shining in you already.
> S17. Pass it on today, to anyone at all. That's exactly how kindness grows and grows.

### Shot table

| # | Type | Sent. | Sec | LTX prompt +STYLE | Overlay |
|---|---|---|---|---|---|
| 1 | Wide | S1–S2 | 8 | EL-ROOM, morning light, EL-GRANDPARENT in EL-CHAIR leans forward earnestly, EL-BOOK open; slow push-in +STYLE | Title: "Kind Words" |
| 2 | Medium hero | S3 | 10 | EL-GRANDPARENT cups her hands as if holding sunlight, letting it spill warmly toward camera; medium shot +STYLE | — |
| 3 | Cutaway — lesson visual | S4 | 8 | EL-BOOK illustration: a small seedling character stands taller as golden words float down like light +STYLE | "You can do it" |
| 4 | Close | S5 | 7 | Close: EL-GRANDPARENT invites the viewer to repeat, nodding encouragement, mouthing along +STYLE | Say it with me |
| 5 | Medium hero | S6–S7 | 10 | EL-GRANDPARENT mimes reaching down and lifting someone up with care, then touches her eyes — "notice"; medium shot +STYLE | — |
| 6 | Cutaway — book page | S8–S9 | 6 | EL-BOOK page turn: two small friends share one big cookie, crumbs and smiles; page settles +STYLE | Sharing |
| 7 | Close | S10 | 7 | Close: EL-GRANDPARENT offers an imaginary cookie toward camera, eyebrows up — your turn +STYLE | "Would you like some?" |
| 8 | Medium hero | S11–S12 | 9 | EL-GRANDPARENT's energy softens; she pats the chair arm beside her — sit close — speaking gently; medium shot +STYLE | — |
| 9 | Close | S13 | 8 | Tight close: EL-GRANDPARENT whispers "I'm here" with complete sincerity, slight nod +STYLE | "I'm here" |
| 10 | Cutaway — lesson visual | S14 | 8 | EL-BOOK illustration: small golden coins marked with kind words cost nothing and glow brighter as they're given away +STYLE | — |
| 11 | Cutaway — book page | S15 | 5 | EL-BOOK page: a sunrise spreading over a little village, windows lighting up one by one +STYLE | — |
| 12 | Medium hero | S16 | 10 | EL-GRANDPARENT beams at camera with quiet pride, hands folded; medium shot +STYLE | — |
| 13 | Medium hero | S17 | 9 | EL-GRANDPARENT mimes passing a small glowing light forward to the viewer; medium shot +STYLE | Pass it on |
| 14 | Wide | — (outro) | 7 | Wide EL-ROOM golden and calm, EL-GRANDPARENT waves softly from EL-CHAIR; slow pull-back +STYLE | End card: "Made with AI + family permission" |

**Shot seconds total:** 112 s + cards ≈ 2:00.

**Music bed:** Warm acoustic guitar + soft piano, ~84 BPM, unhurried; the "I'm here" section drops to a single guitar. Gentle, never saccharine-synth. No vocals.

**Source-performance notes:** Conversational and real — this lesson fails if it sounds like a poster. Speak S1–S4 like a secret between you and the child. The three practice lines (S5, S10, S13) each need the full pause, and model the line first at the exact energy you want back: S5 bright, S10 generous, S13 barely above a whisper. S16–S17 warm and direct, no rush into the outro.

---

## Lesson 6 — Feelings Have Names

**Age band:** 3–8 · **Target runtime:** ~2:00 · **Learning goal:** Name happy, sad, angry, scared, and calm — and learn one kind thing to do with each.
**Content mapping:** as Lesson 1.
**Script length:** 254 words · 16 numbered sentences (spoken text counted, [pause] markers excluded).

### Narration script

> S1. Feelings visit absolutely everybody in this world, my love — even grandparents, even grown-ups, even me.
> S2. And every single feeling has its own name. When we give a feeling its name, it gets smaller and friendlier.
> S3. Happy feels like warm sunshine spreading slowly all through your chest and out to your fingers.
> S4. Happy makes your feet want to dance all by themselves. Show me your happiest face! [pause]
> S5. Sad feels like soft rain on the window — slow, and gray, and quiet.
> S6. When you're sad, tears are always allowed. Hugs help a lot. And telling somebody helps most of all.
> S7. Angry feels like a whole thunderstorm inside — loud, and rumbly, and hard to hold.
> S8. When you're angry, stomp your feet, squeeze your hands tight, and breathe the whole storm out. [pause]
> S9. Scared feels like a shadow on the wall that looks much bigger than it really is.
> S10. When you're scared, go and find your grown-up. Being brave means asking for help out loud.
> S11. And calm — calm feels just like this room feels. Warm. Safe. Slow. And quiet.
> S12. Let's practice being calm together, right now. Breathe in slowly — two, three, four.
> S13. And now breathe it all out, slow as honey — two, three, four. [pause]
> S14. Happy, sad, angry, scared, calm — five feelings, and every one of them has a name.
> S15. Whatever feeling comes to visit you, my love, now you can name it out loud.
> S16. And whatever you feel, whenever you feel it, you are loved — all the way through it, every time.

### Shot table

| # | Type | Sent. | Sec | LTX prompt +STYLE | Overlay |
|---|---|---|---|---|---|
| 1 | Wide | S1–S2 | 8 | EL-ROOM calm and safe, EL-GRANDPARENT in EL-CHAIR welcomes camera in like a confidence; slow push-in +STYLE | Title: "Feelings Have Names" |
| 2 | Medium hero | S3–S4 | 10 | EL-GRANDPARENT beams, hand on her sunny chest, then does a tiny seated happy-dance, inviting imitation; medium shot +STYLE | HAPPY |
| 3 | Close | S4 | 7 | Close: EL-GRANDPARENT's most joyful face held for the child's turn, nodding along +STYLE | Your turn |
| 4 | Cutaway — lesson visual | S5–S6 | 8 | EL-ROOM window with gentle rain outside the glass, a small illustrated figure is comforted by a bigger one +STYLE | SAD |
| 5 | Medium hero | S7–S8 | 10 | EL-GRANDPARENT rumbles comically like thunder, stomps softly in place, squeezes fists, then blows the storm out in one long breath; medium shot +STYLE | ANGRY |
| 6 | Cutaway — book page | S9–S10 | 6 | EL-BOOK page turn: a big shadow on the wall shrinks to reveal a small, harmless mouse; a grown-up hand reaches in +STYLE | SCARED |
| 7 | Medium hero | S11 | 9 | EL-GRANDPARENT settles deep into EL-CHAIR, shoulders dropping, the whole room seeming to slow with her; medium shot +STYLE | CALM |
| 8 | Close | S12–S13 | 8 | Close: EL-GRANDPARENT breathes in visibly, fingers rising — two, three, four — then exhales slowly, guiding camera +STYLE | Breathe in… breathe out |
| 9 | Cutaway — lesson visual | S14 | 8 | Five soft illustrated icons in EL-BOOK: sun, rain cloud, storm, shadow, and this room — each glows as named +STYLE | 5 feelings |
| 10 | Medium hero | S15 | 10 | EL-GRANDPARENT counts the five feelings on her fingers slowly, confidently; medium shot +STYLE | — |
| 11 | Cutaway — book page | — | 5 | EL-BOOK page: all five weathers in one sky, and below them one small figure standing loved and whole +STYLE | — |
| 12 | Close | S16 | 8 | Tight close: EL-GRANDPARENT's warmest, steadiest gaze — the promise of the lesson, delivered quietly +STYLE | — |
| 13 | Medium hero | — (beat) | 9 | EL-GRANDPARENT wraps her own arms around herself in a big hug, offering the gesture to camera; medium shot +STYLE | — |
| 14 | Wide | — (outro) | 7 | Wide EL-ROOM, peaceful lamplight, EL-GRANDPARENT waves gently from EL-CHAIR; slow pull-back +STYLE | End card: "Made with AI + family permission" |

**Shot seconds total:** 113 s + cards ≈ 2:00.

**Music bed:** Solo piano with long pauses, ~72 BPM, weather-like: a brighter motif for happy, a slow minor figure for sad, a low soft rumble (cello, gentle — never scary) for angry, and resolution to the warm home theme for calm. No vocals.

**Source-performance notes:** Act each feeling at 70% — real enough to recognize, never enough to frighten a 3-year-old; angry is rumbly-comic, scared is hushed and brave. The breathing in S12–S13 must be genuinely slow: actually breathe with the counts, because every converted video inherits your breath. S16 is a promise — deliver it at the slowest, warmest pace in the whole pack.

---

## Lesson 7 — Animal Sounds

**Age band:** 2–6 · **Target runtime:** ~2:00 · **Learning goal:** Match farm and favorite animals to their sounds — pure call-and-response joy.
**Content mapping:** as Lesson 1.
**Script length:** 248 words · 16 numbered sentences (spoken text counted, [pause] markers excluded).

### Narration script

> S1. Shhh — listen very carefully with your biggest ears! Do you hear that, out beyond the fields? The farm is waking up!
> S2. The cow says moo! Low and slow and rumbling — mooo. Now it's your turn! [pause]
> S3. The pig says oink! Oink, oink, oink — rolling in the cool brown mud, happy as a pig can possibly be.
> S4. The sheep says baa! Baa, baa — soft and woolly as your very favorite sweater.
> S5. The duck says quack! Quack, quack — waddling and paddling, splash, splash, splash in the pond! [pause]
> S6. The horse says neigh! Neigh — and clip-clop, clip-clop go her proud, dancing feet.
> S7. The chicken says cluck! Cluck, cluck, cluck — busy, busy, busy, all the day long.
> S8. And the rooster wakes up the whole wide world with it: cock-a-doodle-doo! [pause]
> S9. Now for the favorites of all. The cat says meow — small, and polite, and very precise.
> S10. The dog says woof! Woof, woof — because he is just so happy to see you!
> S11. The lion says ROAR — the biggest, grandest sound, that shakes the tall grass! [pause]
> S12. And the mouse? The tiny little mouse says… squeak. The littlest, teeniest sound of all.
> S13. Now let's put the whole farm together in one song: moo, oink, baa, and quack!
> S14. Neigh, cluck, meow, and woof — everybody singing their own song at once!
> S15. Roar like a great big lion — and then squeak like one tiny mouse. [pause]
> S16. What a noisy, wonderful, splashing, singing farm we made together, just you and I!

### Shot table

| # | Type | Sent. | Sec | LTX prompt +STYLE | Overlay |
|---|---|---|---|---|---|
| 1 | Wide | S1 | 8 | EL-ROOM at dawn-pink light, EL-GRANDPARENT in EL-CHAIR cups one ear, listening with delight; slow push-in +STYLE | Title: "Animal Sounds" |
| 2 | Medium hero | S2 | 10 | EL-GRANDPARENT does a grand low moo, hands cupped like a cowbell, then leans in for the child's turn; medium shot +STYLE | COW — moo |
| 3 | Cutaway — lesson visual | S3–S4 | 8 | EL-BOOK illustration: a gleeful pig in mud, then a woolly sheep, both bouncing in rhythm +STYLE | PIG — oink · SHEEP — baa |
| 4 | Medium hero | S5–S6 | 10 | EL-GRANDPARENT quacks with flapping elbows, then neighs with clip-clop hands on her knees; medium shot +STYLE | DUCK · HORSE |
| 5 | Cutaway — book page | S7–S8 | 6 | EL-BOOK page turn: a busy hen clucking across the page, then a proud rooster on a fence at sunrise +STYLE | HEN · ROOSTER |
| 6 | Close | S9 | 7 | Close: EL-GRANDPARENT's daintiest polite meow, little paw gesture, whisker-twitch smile +STYLE | CAT — meow |
| 7 | Medium hero | S10 | 9 | EL-GRANDPARENT woofs joyfully, whole body in it, tail-wag wiggle in EL-CHAIR; medium shot +STYLE | DOG — woof |
| 8 | Close | S11 | 8 | Close: EL-GRANDPARENT builds suspense, then the biggest friendliest lion ROAR, mane-hands around her face +STYLE | LION — ROAR |
| 9 | Cutaway — lesson visual | S12 | 8 | EL-BOOK illustration: the tiniest mouse under a leaf, a small speech bubble with a squeak; the page is mostly quiet space +STYLE | MOUSE — squeak |
| 10 | Medium hero | S13–S14 | 10 | EL-GRANDPARENT conducts the animal chorus like an orchestra, pointing to camera sections for each sound; medium shot +STYLE | moo · oink · baa · quack |
| 11 | Cutaway — book page | S15 | 5 | EL-BOOK page: lion and mouse side by side, roaring and squeaking together, musical notes big and small +STYLE | ROAR / squeak |
| 12 | Medium hero | S16 | 9 | EL-GRANDPARENT applauds the viewer's farm, laughing, taking a playful bow from EL-CHAIR; medium shot +STYLE | — |
| 13 | Close | — (beat) | 7 | Close: EL-GRANDPARENT listens one last time, finger up — far-off animals answer softly — she smiles +STYLE | — |
| 14 | Wide | — (outro) | 7 | Wide EL-ROOM, morning gold, EL-GRANDPARENT waves from EL-CHAIR; slow pull-back +STYLE | End card: "Made with AI + family permission" |

**Shot seconds total:** 112 s + cards ≈ 2:00.

**Music bed:** Bouncy banjo + fiddle, light and comedic, ~104 BPM, leaving big silent gaps after each animal call for the child's answer; a soft barnyard dawn ambience under the open and close only. No vocals, no recorded animal SFX in the bed (the reader's voice makes the sounds).

**Source-performance notes:** This is the pack's silliest performance — commit. Each animal sound gets its full size: moo low, rooster enormous, squeak tiny enough to lean in for. The [pause] after S2, S5, S8, S11, S15 is where toddlers shout back; hold the full 2 counts with a listening face in your voice (don't fill it). Keep S13–S14's recap in strict rhythm so it becomes chantable.

---

## Lesson 8 — Please and Thank You

**Age band:** 2–7 · **Target runtime:** ~2:00 · **Learning goal:** Use "please" and "thank you" as everyday magic words, and feel gratitude as warmth, not obligation.
**Content mapping:** as Lesson 1.
**Script length:** 241 words · 16 numbered sentences (spoken text counted, [pause] markers excluded).

### Narration script

> S1. I know two magic words, my love — real, true, everyday magic that any child can carry in their pocket.
> S2. The very first word is "please." Please turns plain asking into kindness.
> S3. "More berries, please, Grandma" — just listen to how sweet and warm that sounds.
> S4. Now it's your turn. Say it right out loud with me: please! [pause]
> S5. The second magic word is really two little words together: "thank you" — and together, they might be the strongest of all.
> S6. "Thank you" tells somebody something important: I see what you did, and it truly mattered to me.
> S7. Thank you for the story. Thank you for the snack. Thank you for the hand that held mine.
> S8. And thank you for the hug — the one that fixed the whole entire day.
> S9. Say it with me now, strong and clear: thank you! [pause]
> S10. Grown-ups absolutely light up when they hear these words coming out of a child's mouth.
> S11. Teachers light up. Neighbors light up. Grandmas — oh, grandmas definitely light up.
> S12. But here is the secret hiding inside the magic: it isn't really in the words at all.
> S13. It's in the noticing. A grateful heart learns to see gifts absolutely everywhere.
> S14. Thank you, warm sun, for shining on us. Thank you, soft rain, for watering all the flowers.
> S15. And my grateful heart says one more thank-you, every single day of my life:
> S16. Thank you — thank you, thank you — for wonderful, marvelous you.

### Shot table

| # | Type | Sent. | Sec | LTX prompt +STYLE | Overlay |
|---|---|---|---|---|---|
| 1 | Wide | S1 | 8 | EL-ROOM, EL-GRANDPARENT in EL-CHAIR leans in with a delicious secret, EL-BOOK closed, finger raised; slow push-in +STYLE | Title: "Please and Thank You" |
| 2 | Medium hero | S2–S3 | 10 | EL-GRANDPARENT asks the air sweetly for berries, palms up, then tastes an imaginary berry with bliss; medium shot +STYLE | PLEASE |
| 3 | Close | S4 | 7 | Close: EL-GRANDPARENT invites the word, cupping her ear, then beams at the answer +STYLE | Your turn: please! |
| 4 | Cutaway — book page | S5–S6 | 6 | EL-BOOK page turn: the words THANK YOU illustrated as a small wrapped gift being handed over, ribbon glowing +STYLE | THANK YOU |
| 5 | Medium hero | S7–S8 | 10 | EL-GRANDPARENT counts thanks on her fingers — story, snack — then mimes the day-fixing hug, rocking gently; medium shot +STYLE | — |
| 6 | Close | S9 | 7 | Close: EL-GRANDPARENT leads "thank you!" like a cheer, then listens, glowing +STYLE | Say it: thank you! |
| 7 | Cutaway — lesson visual | S10–S11 | 8 | EL-BOOK illustration: a teacher and a grandma light up with literal warmth as the words float by +STYLE | — |
| 8 | Medium hero | S12–S13 | 9 | EL-GRANDPARENT's tone turns wondrous; she looks around EL-ROOM slowly, noticing everything as if new; medium shot +STYLE | — |
| 9 | Medium hero | S14 | 10 | EL-GRANDPARENT thanks the window sun, then the rain clouds beyond it, palms open in gratitude; medium shot +STYLE | ☀ 🌧 |
| 10 | Cutaway — lesson visual | S14 | 8 | Out the window: sunbeams and gentle rain taking turns over a blooming garden, gratitude as weather +STYLE | — |
| 11 | Cutaway — book page | S15 | 5 | EL-BOOK page: EL-GRANDPARENT's illustrated heart with a speech ribbon about to speak; the ribbon is blank and waiting +STYLE | — |
| 12 | Close | S16 | 8 | Tight close: EL-GRANDPARENT delivers the final line straight down the lens, hands on heart, eyes shining +STYLE | Thank you — for you |
| 13 | Medium hero | — (beat) | 9 | EL-GRANDPARENT sinks back into EL-CHAIR, content, holding the moment with a soft smile; medium shot +STYLE | — |
| 14 | Wide | — (outro) | 7 | Wide EL-ROOM golden, EL-GRANDPARENT waves from EL-CHAIR; slow pull-back +STYLE | End card: "Made with AI + family permission" |

**Shot seconds total:** 112 s + cards ≈ 2:00.

**Music bed:** Tender felt piano + soft nylon guitar, ~80 BPM, lullaby-adjacent but awake; a tiny music-box motif answers each "please" and "thank you" like an echo of good manners. No vocals.

**Source-performance notes:** Say the magic words like they're delicious — S3's "More berries, please" should be the sweetest sentence in the pack. Keep S5–S6 explanatory but light; gratitude here is a game, not a lecture. Slow down from S12 (the secret) onward; S16 gets the full weight of a real thank-you to a real grandchild — quiet, direct, final.

---

## Lesson 9 — Someone Who Loves You ⭐ PILOT DEMO / HERO LESSON

**Age band:** 2–8 (whole pilot range) · **Target runtime:** ~2:00 · **Learning goal:** Feel the lesson underneath all the others: someone loves you — near, far, always — and love travels.
**⭐ This is the pilot demo lesson.** Produce this one first (see Part 4). If only one master gets made in Week 3, it's this one: it demos best because the product's promise *is* this lesson — a faraway grandparent, in the chair, telling a grandchild exactly this.
**Content mapping:** as Lesson 1.
**Script length:** 251 words · 17 numbered sentences (spoken text counted, [pause] markers excluded).

### Narration script

> S1. Come close, my love, and listen well. This is the truest story I know how to tell.
> S2. Somewhere in this big wide world, there is someone who loves you very much.
> S3. Maybe that someone lives right down the street, close enough to visit every day.
> S4. Or maybe they live far, far away — over the hills, past the river, and under different stars.
> S5. But love doesn't mind the miles, not one bit. Love knows how to travel.
> S6. Love travels in a story, read out loud slowly, just for you and nobody else.
> S7. Love travels in a song, hummed soft and low at bedtime, every single night.
> S8. Love travels in a voice that says your name like it's a present being unwrapped. [pause]
> S9. And when you hear that voice, something deep in your chest feels warm and safe.
> S10. That's love, arriving at your door — right on time, like it always does.
> S11. Some days, love is a hug that you can hold onto tight.
> S12. And some days, love is a story that you can hear whenever you need it.
> S13. But both days — every day — it is really, truly, completely love. [pause]
> S14. So whenever you miss someone, all you have to do is listen for the story.
> S15. And there they'll be — right in the chair, right in the story, right in your heart.
> S16. Someone loves you, my love. More than all the stars in all the sky.
> S17. And that — that one true thing — never, ever, ever changes. Not for anything.

### Shot table

| # | Type | Sent. | Sec | LTX prompt +STYLE | Overlay |
|---|---|---|---|---|---|
| 1 | Wide | S1–S2 | 8 | EL-ROOM at its most golden, EL-GRANDPARENT in EL-CHAIR reaches gently toward camera as if gathering someone close; slow push-in +STYLE | Title: "Someone Who Loves You" |
| 2 | Medium hero | S3–S4 | 10 | EL-GRANDPARENT gestures first near — a hand's width — then sweeps wide across imaginary hills and a river, wistful and smiling; medium shot +STYLE | — |
| 3 | Cutaway — lesson visual | S5 | 8 | A storybook map illustration: a dotted golden path of light travels over hills and a river from one small house to another +STYLE | Love travels |
| 4 | Medium hero | S6–S7 | 10 | EL-GRANDPARENT reads from EL-BOOK with her whole heart, then hums a line, swaying softly; medium shot +STYLE | — |
| 5 | Close | S8 | 7 | Close: EL-GRANDPARENT says the listener's "name" like a present — she mimes unwrapping something precious as she speaks +STYLE | — |
| 6 | Cutaway — book page | S9–S10 | 6 | EL-BOOK page turn: a small illustrated chest glows warm from inside as a voice-wave ribbon arrives and settles in +STYLE | — |
| 7 | Medium hero | S11–S12 | 9 | EL-GRANDPARENT mimes a real hug, arms full — then opens EL-BOOK wide: the other kind of love, given equal honor; medium shot +STYLE | — |
| 8 | Close | S13 | 8 | Close: EL-GRANDPARENT nods slowly, certain — "really, truly" — eyes kind and unwavering +STYLE | Really, truly love |
| 9 | Medium hero | S14–S15 | 10 | EL-GRANDPARENT cups her ear — listen — then touches the chair, the book, and her heart in turn: chair, story, heart; medium shot +STYLE | — |
| 10 | Cutaway — lesson visual | S16 | 8 | The EL-ROOM window at dusk: a sky full of storybook stars, more than can be counted, one winking +STYLE | More than all the stars |
| 11 | Cutaway — book page | — | 5 | EL-BOOK's last page: the grandparent character and a small child silhouette reading together inside a heart-shaped pool of lamplight (illustration only) +STYLE | — |
| 12 | Close | S17 | 8 | Tight close: EL-GRANDPARENT delivers the final promise slowly, forehead nearly touching the lens's heart, absolute warmth +STYLE | Never, ever changes |
| 13 | Medium hero | — (beat) | 9 | EL-GRANDPARENT rests her hand on EL-BOOK, smiling the smile after good news, in no hurry to leave; medium shot +STYLE | — |
| 14 | Wide | — (outro) | 7 | Wide EL-ROOM at lamplight, EL-GRANDPARENT waves slowly from EL-CHAIR like a promise kept; slow pull-back +STYLE | End card: "Made with AI + family permission" |

**Shot seconds total:** 113 s + cards ≈ 2:00.

**Music bed:** The series' signature theme at its fullest: warm piano + soft strings, ~76 BPM, a melody simple enough to become *the* VoxTree sound; it should be able to carry the whole video almost alone. License/commission one series theme and reuse motifs in all ten beds — this lesson is where the theme is established.

**Source-performance notes:** This performance is the product demo — record it last of the ten, when the reader is warmed up, and record three full takes (the pack's only three-take lesson). Speak S4's distance gently, never sadly — this family is loved across the miles, not pitied for them. S8's [pause] is a held breath before the name-present moment; give it its full length. S16–S17: the slowest delivery in the pack, one word of promise at a time.

---

## Lesson 10 — Goodnight Wind-Down

**Age band:** 2–8 · **Target runtime:** ~2:00 (deliberately the slowest lesson) · **Learning goal:** Down-regulate for sleep: name the day, breathe it out, and close with safety and love.
**Content mapping:** as Lesson 1.
**Script length:** 236 words · 18 numbered sentences (spoken text counted, [pause] markers excluded).

### Narration script

> S1. The day is all done now, my love. It's time to get soft and sleepy.
> S2. Let's put the whole wide day to bed, one gentle piece at a time.
> S3. The toys are resting now, all in their places. The shoes are resting quietly, too.
> S4. The golden sun has gone to bed behind the hills for the night.
> S5. And the silver moon is up instead, keeping watch over everything, quiet and kind.
> S6. Let's breathe the whole day out together. Breathe in, nice and slow…
> S7. And let it out — out it goes, like one long sigh. [pause]
> S8. One more time. Breathe in all the calm in the world…
> S9. And breathe out all the busy of the day. [pause]
> S10. Your body is getting heavy and warm, like a sleepy bear in its cozy den.
> S11. Your eyes are getting soft and heavy, like a kitten napping in the sun.
> S12. Now think of one good thing from today. Just one good, small thing.
> S13. Hold that good thing in your heart, like a tiny glowing lantern. [pause]
> S14. Tomorrow will come soon enough, and it will bring brand-new adventures with it.
> S15. But tonight — tonight there is nothing at all that you have to do.
> S16. Nothing to fix, nothing to finish, nothing to carry. Only rest.
> S17. I love you in the busy morning. And I love you in the quiet night.
> S18. Sleep well, my dearest love. I'm right here — right here in the story.

### Shot table

| # | Type | Sent. | Sec | LTX prompt +STYLE | Overlay |
|---|---|---|---|---|---|
| 1 | Wide | S1–S2 | 8 | EL-ROOM at blue-hour dusk, lamp the main glow, EL-GRANDPARENT in EL-CHAIR speaks softly, the room settling; very slow push-in +STYLE | Title: "Goodnight Wind-Down" |
| 2 | Medium hero | S3 | 10 | EL-GRANDPARENT gestures gently around at resting things, voice-soft body language, eyelids at half-mast by example; medium shot, slowest camera in the pack +STYLE | — |
| 3 | Cutaway — lesson visual | S4–S5 | 8 | Out the EL-ROOM window: a storybook sun slides behind hills as a silver moon rises to keep watch +STYLE | 🌙 |
| 4 | Medium hero | S6–S7 | 10 | EL-GRANDPARENT breathes in visibly and sighs out, shoulders melting down into EL-CHAIR, guiding by example; medium shot +STYLE | Breathe in… and out |
| 5 | Close | S8–S9 | 7 | Close: EL-GRANDPARENT's calm face breathes once more, slower, a tiny peaceful smile at the exhale +STYLE | — |
| 6 | Cutaway — book page | S10–S11 | 6 | EL-BOOK page turn, dreamlike: a bear curled in its den, then a kitten asleep in a patch of sun +STYLE | — |
| 7 | Medium hero | S12–S13 | 9 | EL-GRANDPARENT mimes holding one small glowing good-thing between her palms, then presses it gently to her heart; medium shot +STYLE | One good thing |
| 8 | Cutaway — lesson visual | S13 | 8 | A tiny illustrated lantern glows inside a heart shape, light breathing in and out slowly +STYLE | — |
| 9 | Medium hero | S14–S16 | 10 | EL-GRANDPARENT waves away tomorrow's adventures gently — not tonight — then empties her hands, palms open, utterly unburdened; medium shot +STYLE | — |
| 10 | Close | S17 | 8 | Close: EL-GRANDPARENT counts the loves on two fingers — morning, night — tender and certain +STYLE | — |
| 11 | Cutaway — book page | — | 5 | EL-BOOK's final page: the reading room itself, asleep — lamp dimmed, blanket over the chair, stars at the window (illustration) +STYLE | — |
| 12 | Close | S18 | 8 | Tight close, near-whisper framing: EL-GRANDPARENT's last line delivered like a secret kept safe all night +STYLE | Sleep well |
| 13 | Medium hero | — (beat) | 9 | EL-GRANDPARENT closes EL-BOOK with infinite gentleness and rests both hands on it, still and warm; medium shot +STYLE | — |
| 14 | Wide | — (outro) | 7 | Wide EL-ROOM in lamplight and moonlight, EL-GRANDPARENT gives the smallest, sleepiest wave; slowest pull-back in the pack +STYLE | End card: "Made with AI + family permission" |

**Shot seconds total:** 113 s + cards ≈ 2:00.

**Music bed:** Solo piano + a single soft cello line, ~60 BPM and slowing across the two minutes (a composed ritardando); melody from the Lesson 9 series theme, stripped to almost nothing. This is the one bed where the instrumental may sit slightly higher — it is doing sleep work. No vocals, no chimes, nothing that wakes.

**Source-performance notes:** Perform at least 20% slower and 30% softer than any other lesson — actually get sleepy; the conversion inherits your drowsiness, which is the point. Real, audible breaths in S6–S9, timed long. Never brighten at the end: S17–S18 should be the quietest lines in the entire pack, trailing toward silence, not a "big finish."

---

# PART 3 — DEMO REFERENCE PASSAGE (for the demo adult's voice recording)

**What this is:** The recording script for the Week 3 demo adult, under the Launch Content Pack §6 consent packet (explainer read first, consent form signed, the 6c checklist followed). **Why it's built this way:** SeedVC's zero-shot reference is **1–30 seconds** (PR #47 contract). We therefore **record long (2–3 minutes) and select the single cleanest 15–30 s segment as the model reference clip**, keeping the full take for voice QA, A/B comparison against converted output, and future use. The passage is phonetically rich on purpose — varied vowels, consonant clusters, questions, exclamations, whispers, numbers, a list, and proper names — so whichever segment is chosen, the reference carries the sounds the lessons will ask the clone to say. It's written in **seven standalone segments (R1–R7)**, each self-contained, so any one of them can be lifted cleanly. **Recommended reference lift: R2 or R3** (warm, complete sentences, varied sounds, at natural energy).

### The passage — 347 words (read exactly as written, at your own natural storyteller pace; ≈2–3 min with natural pauses)

> **R1.** Hello, my love. This is my voice, and I'm so glad it found you. Some voices are loud and some are soft, but mine is happiest right here, close to you, telling you a story. It has laughed with you, and sung to you, and it isn't going anywhere.
>
> **R2.** Let me tell you about a morning in Maple Grove. The sun came up gold over the rooftops, the robins argued in the lilac bush, and Mrs. Delgado opened her bakery before anyone else was awake. Can you smell the warm bread? I can. Somewhere a kettle clicked off, and somebody's grandfather burned the toast again, on purpose, because he liked it that way.
>
> **R3.** On Saturday we counted everything in the kitchen. Seven speckled eggs, three bruised peaches, twelve smooth stones from the creek, and one very patient cat named Biscuit. Biscuit counted nothing. Biscuit supervised. The flour went everywhere, of course, and nobody minded at all.
>
> **R4.** Quickly, quietly, the children ran past the picket fence — splash through the puddles, crash through the leaves! "Wait for me!" called Peter. "Slow down!" laughed Grandma Rose, though she didn't mean it, not really. The wind pushed at their coats and pulled at their hats, and the whole street smelled like rain coming.
>
> **R5.** *(softly, like a secret)* Now I will tell you the quiet part. Stars are patient. The moon is kind. And everything you love is closer than you think, even when you can't see it from where you're standing. Close your eyes. Listen. There it is — the sound of being loved, humming underneath everything.
>
> **R6.** Say it with me: brave, bright, strong, and true. And again, slower: brave. Bright. Strong. True. Thank you. Please. I'm here. You can do it. I love you in the morning, I love you at night, and I love you in every ordinary minute in between.
>
> **R7.** So that's my voice — high and low, loud and whisper-soft, quick and slow. Keep it somewhere safe, right next to your heart, from my heart to yours, just like always. And whenever you're ready… press play, and I'll begin again.

### Recording instructions (aligned to Launch Content Pack §6c checklist)

1. **Consent first, always.** Explainer (6a) read/hand over and questions answered *before* recording; form (6b) signed — including the separate marketing ☐, which governs whether any clip may ever be posted publicly. No signature, no recording.
2. **Room:** quietest room available, soft furnishings if possible; doors/windows closed, fans and TV off, phone on Do Not Disturb. No echoey kitchen/bathroom.
3. **Phone position:** phone on a stack of books at mouth height, ~20–30 cm (8–12 in) away, slightly off to the side — not held, not on a hard table that rings. Record in the phone's voice recorder at its highest quality (WAV/lossless if offered).
4. **Performance:** read R1–R7 in one take if comfortable, pausing one breath between segments (the segment gaps are what make lifting easy). Natural pace, natural warmth — do not "perform an announcer voice"; SeedVC will clone the voice you actually give it.
5. **One retake rule:** exactly one full retake is offered if *they* want it (per §6c). Keep Take 1 regardless — the first take is usually the most natural — and label both.
6. **File naming (per §6c item 5 — everything filed under the adult's name + date, with the signed form):**
   - `demo_<lastname-firstname>_ref_full-take1_<YYYY-MM-DD>.wav` (and `..._take2_...` if retaken)
   - `demo_<lastname-firstname>_photo-1..n_<YYYY-MM-DD>.jpg`
   - `demo_<lastname-firstname>_consent-signed_<YYYY-MM-DD>.pdf`
   - The selected reference clip, once chosen: `demo_<lastname-firstname>_seedvc-reference_<segment, e.g. R2>_<seconds>s.wav`
7. **Session log (per §6c item 7 spirit):** note the segment chosen for the reference, why (cleanest audio / most representative), and the recorder + room used — the Week 3 cost/quality log starts here.

---

# PART 4 — WEEK 3 DEMO SEQUENCING + WHAT THIS PACK DOES NOT DECIDE

**Produce in this order:**
1. **Lesson 9 — Someone Who Loves You — first, as the hero.** It's the demo lesson (Blueprint §9 picks "the shortest lesson script" for the first hand-built master; Lesson 9 is mid-length but it's the one that proves the promise — if the schedule forces a trade, shoot Lesson 9's first 60 seconds (Shots 1–7) as the §9 Day 3–4 test cut, then complete it). Its three source-performance takes are the pack's only three-take session.
2. **Then Lesson 1 (Alphabet)** — highest toddler replay value, and its chant-like lines are the kindest possible test of SeedVC conversion intelligibility.
3. **Then Lesson 10 (Goodnight Wind-Down)** — the second-most-likely daily-use lesson, and the strictest test of quiet-dynamics conversion.

**Record source performances in this order (one session if the reader is fresh, two if not):** Lesson 9 (takes 1–3) → Lesson 2 (Counting; sets the dynamic range) → Lesson 1 → Lesson 7 (Animal Sounds; silliest, best mid-session) → Lessons 3, 4, 5, 6, 8 in any order → Lesson 10 **last, always** — its genuine drowsiness can't be faked after a break, so record it at the end of the day when the reader is actually tired.

**This pack does NOT decide (Goding's calls, unchanged):** the demo adult (Launch Content Pack §6 packet is ready for whoever he names); whether/when the LTX Studio Standard subscription ($35/mo, the first tier with a commercial license + Elements — Blueprint §8) is bought and against which budget line; whether real photo/video bookends are tested in the demo (Style Decision: discussed, deliberately not locked); the demo GPU configuration order; and any pivot if measured demo costs break the ~$2/video target (Blueprint §9 kill/pivot criteria apply).

*Master Lesson Scripts + LTX Shot Pack — built Nov 2, 2026, from the Pipeline Blueprint (shot pattern, format contracts, SeedVC contract) and the Oct 29 locked Style Decision. All scripts and the demo passage are original VoxTree writing. Local document only — nothing pushed, posted, rendered, or recorded.*
