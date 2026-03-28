# PR HTML Workflow — Tableicity Press Release Template

## What You Provided

1. **A full HTML sample** (`Google_Mar_27_HTML_1774660586915.docx`) — A complete press release page for Los Angeles showing the ideal semantic HTML structure: `<article>`, `<header>`, `<section>`, `<footer>`, `<blockquote>`, `<figure>`, `<ul>`, proper heading hierarchy (h1 → h2 → h3), `<time>` tag, and byline markup.

2. **A Google Schema recommendation** (`Google_Mar_27_HTML_Schemas_1774660586914.docx`) — JSON-LD NewsArticle structured data guidance, image best practices (16:9, near top of page), and validation tips for Google Rich Results.

3. **Specific instructions:**
   - Ignore any HTML that changes Meta Title or Meta Description (those are already set per-city)
   - Use beast-02-code-vault.png (photo #2 in gallery) with alt text "Cap Table Solution for Equity Management"
   - Split the 3rd paragraph into a two-panel layout: left panel = text, right panel = photo
   - Apply across all city press releases

## What Was Built

A new content template called **"Tableicity PR Hash-256"** was created in Admin → Templates → Content Templates.

### Template ID
`db8f5c47-9da2-400a-9ba8-869bef11d39e`

### Semantic HTML Structure Applied

| Element | Usage | Why |
|---------|-------|-----|
| `<article>` | Wraps entire press release | Google identifies it as a self-contained news piece |
| `<header>` | Contains h1, subtitle, byline | Signals the article's intro block |
| `<h1>` | City headline | Primary heading for SEO |
| `<h2>` | Section headers ("Data Honey-Pot", "Key Innovation") | Google sees content hierarchy |
| `<h3>` | "About Tableicity" footer | Proper subordination |
| `<section>` | Each content block | Semantic grouping of related content |
| `<blockquote>` | Brian Reynolds CEO quote | Google treats as attributed quote |
| `<figure>` + `<img>` | Photo in right panel | Google recognizes as meaningful content image |
| `<ul>` + `<li>` | Feature bullet list | Structured data for feature highlights |
| `<time datetime="">` | Dateline | Machine-readable date matching JSON-LD |
| `<footer>` | About section | Signals boilerplate/closing info |
| `<strong>` | Key terms, city name, landmarks | Emphasis for crawlers |

### Two-Panel Layout (Paragraph 3)

The third paragraph is split into a flex layout:

- **Left panel (50%)**: "In an era where a single leaked screenshot..." text with {{landmarks}} placeholder
- **Right panel (50%)**: beast-02-code-vault.png inside a `<figure>` element with alt text "Cap Table Solution for Equity Management", 12px border radius

### What Was Intentionally Ignored

| Item | Reason |
|------|--------|
| `<title>` tag | Already managed per-city by generateMetadata |
| `<meta name="description">` | Already managed per-city by generateMetadata |
| `<meta name="keywords">` | Google publicly ignores this tag |
| JSON-LD `<script>` | Already implemented in the knowledge article page renderer |
| `<!DOCTYPE>`, `<head>`, `<body>` | Press releases render inside the Next.js layout — we only control the article body HTML |

### Placeholders in Template

| Placeholder | Replaced With |
|-------------|---------------|
| `{{city}}` | City name (e.g., Los Angeles) |
| `{{state_code}}` | State abbreviation (e.g., CA) |
| `{{state_name}}` | Full state name (e.g., California) |
| `{{landmarks}}` | City landmarks from database |
| `{{nearby_cities}}` | Nearby cities from database |

## Next Steps — What You Need To Do

### Step 1: Preview the Template
Go to **Admin → Templates → Content Templates** and find "Tableicity PR Hash-256". Use the Preview toggle on the body content to verify the HTML renders correctly.

### Step 2: Assign the Template to Cities
Go to **Admin → Cities**, select the cities you want to update, and use the bulk action to assign the "Tableicity PR Hash-256" template.

### Step 3: Sync Press Releases
Once the template is assigned, the city pages will render the new semantic HTML structure with the two-panel photo layout. The press releases (knowledge articles) are separate — to update those, we would run the sync-template endpoint to push the new HTML body across all 45 published articles.

### Step 4: Validate with Google
After deployment, use the [Google Rich Results Test](https://search.google.com/test/rich-results) to verify the structured data on a sample city press release page. Paste a URL like `https://www.tableicity.com/discovery/knowledge/tableicity-los-angeles-cap-table` and confirm the NewsArticle schema is detected.

### Step 5: Request Re-indexing
In Google Search Console, use URL Inspection on a few updated press release pages and click "Request Indexing" to get Google to re-crawl with the new HTML structure.
