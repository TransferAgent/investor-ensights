# Submitting Tableicity Sitemap to Google Search Console

## Your Sitemap

- **URL**: https://www.tableicity.com/sitemap.xml
- **Total Pages**: 91 URLs (homepage + city pages + knowledge articles)
- **robots.txt**: Already configured at https://www.tableicity.com/robots.txt with sitemap reference

## Step-by-Step: Google Search Console Setup

### 1. Go to Google Search Console
- Visit: https://search.google.com/search-console
- Sign in with your Google account

### 2. Add Your Property
- Click **"Add property"** (top-left dropdown)
- Choose **"URL prefix"** method
- Enter: `https://www.tableicity.com`
- Click **Continue**

### 3. Verify Ownership
Google will offer several verification methods. The easiest options:

**Option A — HTML Meta Tag (Recommended)**
- Google gives you a meta tag like: `<meta name="google-site-verification" content="XXXXXXXXXXXX" />`
- Give me that tag and I'll add it to the site's `<head>` on every page
- Click **Verify** in Google Search Console after it's deployed

**Option B — HTML File Upload**
- Google gives you a file like `googleXXXXXXXX.html`
- Give me that file and I'll add it to the `/public` folder
- Click **Verify** after it's deployed

**Option C — DNS TXT Record**
- Requires access to the domain's DNS settings (wherever tableicity.com is registered)
- Add the TXT record Google provides, then verify

### 4. Submit the Sitemap
- Once verified, go to **Sitemaps** in the left sidebar
- Enter: `sitemap.xml`
- Click **Submit**
- Google will show status as "Pending" initially, then "Success" once crawled

### 5. What Happens Next
- Google typically begins crawling within 24–48 hours
- Full indexing of 91 pages may take 1–2 weeks
- You can check progress under **Coverage** (or **Pages**) in Search Console
- The **Performance** tab will start showing search impressions and clicks once pages are indexed

## What's Already in Place

| SEO Feature | Status |
|---|---|
| Dynamic sitemap.xml | Live — auto-updates when cities/articles are added |
| robots.txt | Live — allows all crawlers, references sitemap |
| Canonical URLs | Every page — locked to https://www.tableicity.com |
| 301 non-www redirect | Active — tableicity.com redirects to www.tableicity.com |
| Meta titles | Every page — unique per city/article |
| Meta descriptions | Every page — unique per city/article |
| OpenGraph tags | City pages + knowledge articles |
| JSON-LD structured data | NewsArticle on knowledge pages, LocalBusiness on city pages |
| Server-side rendering | All public pages — Google sees full HTML immediately |
| Semantic heading hierarchy | h1 → h2 → h3 → h4 properly structured |

## After Verification — Next Steps

1. **Request Indexing** — For priority pages, use the URL Inspection tool in Search Console and click "Request Indexing"
2. **Monitor Coverage** — Check for any crawl errors or excluded pages
3. **Track Performance** — Watch for first impressions in the Performance report (usually 3–7 days after indexing)
