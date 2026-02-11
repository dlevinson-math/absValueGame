# V-Quest: Absolute Value Transformations Game

An interactive browser game that teaches middle school Algebra 1 students how to perform linear transformations of absolute value functions `y = a|x - h| + k`.

---

## Learning Objectives

Students will understand how each parameter in `y = a|x - h| + k` affects the graph:

| Parameter | Transformation |
|-----------|---------------|
| **h** | Horizontal shift (left/right) of the vertex |
| **k** | Vertical shift (up/down) of the vertex |
| **a** (positive) | Steepness of the V-shape (larger = narrower) |
| **a** (negative) | Flips the V-shape to open downward |

## How to Play

1. **Start a game** - click "New Game" on the title screen.
2. **Read the level type:**
   - **Vertex Hunter** - adjust **h** and **k** to move the vertex onto the target point.
   - **Line Crosser** - adjust **a** so one arm of the V passes through the target.
3. **Click a highlighted variable** in the equation bar to change its value (whole numbers only).
4. **Press "Try Solution"** to check your answer.
5. You get **3 attempts per level**. Hints appear after incorrect guesses.
6. Earn 3 stars for a first-try solve, 2 stars for second, 1 star for third.

## For Teachers

### Classroom Use

- Share the live URL with students - no installation required, works on any device with a modern browser.
- The game alternates between **Vertex Hunter** (h, k practice) and **Line Crosser** (slope/a practice).
- Difficulty scales automatically: early levels use values -5 to 5, later levels expand to -10 to 10.
- Progress saves automatically via localStorage, so students can resume later on the same device.

### Suggested Activities

- **Warm-up (5 min):** Have students play 3-4 levels as a class opener.
- **Practice (15 min):** Students work individually, racing to reach the highest score.
- **Discussion:** After playing, ask students to explain *why* increasing h moves the vertex right.
- **Extension:** Challenge students to predict the answer before entering it.

### Standards Alignment

- **CCSS.MATH.CONTENT.HSF.BF.B.3** - Identify the effect on the graph of replacing f(x) by f(x) + k, k f(x), f(kx), and f(x + k).

## Technical Details

- Pure HTML + CSS + JavaScript (no frameworks, no build step)
- Renders on HTML5 Canvas with high-DPI support
- Responsive design for tablets and desktops
- Game state persisted with localStorage

### File Structure

```
/
├── index.html    - Main game file
├── styles.css    - All styling
├── game.js       - Game logic and canvas rendering
└── README.md     - This file
```

### Browser Support

Tested in Chrome, Firefox, Safari, and Edge (latest versions).

## Deploying to GitHub Pages

1. Create a new repository (e.g., `absolute-value-game`)
2. Upload or push all game files (index.html, styles.css, game.js, README.md)
3. Go to **Settings > Pages**
4. Under "Build and deployment," set source to **Deploy from a branch**
5. Select **main** branch and **/ (root)** folder
6. Click **Save**
7. Wait about 60 seconds, then access your game at your GitHub Pages URL

## License

Free to use for educational purposes.
