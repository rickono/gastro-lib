# Michelin Scraper

A Node.js package for scraping restaurant data from the Michelin Guide website.

## Usage

```typescript
import { MichelinScraper } from '@repo/michelin-scraper';

const scraper = new MichelinScraper();
const restaurants = await scraper.scrapeRestaurants('new-york');
console.log(restaurants);
```

## Scripts

- `pnpm dev` - Run in development mode with hot reload
- `pnpm build` - Build the TypeScript code
- `pnpm start` - Run the built code
- `pnpm lint` - Run ESLint
- `pnpm check-types` - Check TypeScript types

## Note

This scraper is for educational purposes. Please respect the website's robots.txt and terms of service when scraping.
