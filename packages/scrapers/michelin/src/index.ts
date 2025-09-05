import * as playwright from 'playwright';

interface Coords {
  lat: number;
  lng: number;
}

export interface MichelinRestaurant {
  name: string;
  coords?: Coords;
  cuisine: string;
  awards: {
    bibGourmand: boolean;
    greenStar: boolean;
    stars: number;
  };
  url: string;
  price: 1 | 2 | 3 | 4;
}

export class MichelinScraper {
  private baseUrl = 'https://guide.michelin.com';

  private getUrl(location: string, page: number = 1): string {
    return `${this.baseUrl}/en/us/${location}/restaurants/page/${page}?sort=distance`;
  }

  async scrapeRestaurants(location?: string): Promise<MichelinRestaurant[]> {
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    try {
      console.log('🔍 Loading Michelin Guide page...');

      let isLastPage = false;
      let pageNum = 1;
      const restaurants: MichelinRestaurant[] = [];
      while (!isLastPage) {
        const url = this.getUrl(location ?? 'illinois/chicago', pageNum);
        console.log(url);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Wait for restaurant listings to load
        const items = await page.waitForSelector('.js-restaurant__list_items', {
          timeout: 10000,
        });

        const resultsEl = await page.$('.js-restaurant__stats');
        const resultsText = await resultsEl?.textContent();
        if (resultsText) {
          pageNum += 1;
          const [, from, to, total] =
            resultsText.match(/(\d+)-(\d+) of (\d+)\s+restaurants/) ?? [];
          console.log(from, to, total);
          if (from && to && total) {
            isLastPage = parseInt(to, 10) >= parseInt(total, 10);
          }
        } else {
          isLastPage = true;
        }

        // Get all restaurant cards
        const restaurantElements = await items.$$('.js-restaurant__list_item');
        console.log(`Found ${restaurantElements.length} restaurants`);

        for (const element of restaurantElements) {
          if (!element) continue;

          try {
            // Extract restaurant data from each card
            const lat = await element.getAttribute('data-lat');
            const lng = await element.getAttribute('data-lng');
            let coords: Coords | undefined;
            if (lat && lng) {
              coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
            }

            const name =
              (await element.$eval('.card__menu-content--title', (el) =>
                el.textContent?.trim()
              )) || '';

            let cuisine = '';
            let dollars = 0;
            const cuisineSelectors = '.card__menu-footer--score';
            try {
              const cuisineEl = await element.$$(cuisineSelectors);
              for (const element of cuisineEl) {
                const cuisineText = (await element.textContent()) || '';
                const isCuisineField = cuisineText.includes('·');
                if (isCuisineField) {
                  const [dollar, cuisineType] = cuisineText
                    .split('·')
                    .map((s) => s.trim());
                  if (cuisineType) {
                    cuisine = cuisineType;
                  }
                  dollars = Array.from(dollar ?? '').reduce(
                    (tot, char) => (char === '$' ? tot + 1 : tot),
                    0
                  );
                  break;
                }
              }
            } catch (e) {}

            // Get the restaurant URL
            const linkElement = await element.$('a');
            const relativeUrl = (await linkElement?.getAttribute('href')) || '';
            const url = relativeUrl.startsWith('http')
              ? relativeUrl
              : `${this.baseUrl}${relativeUrl}`;

            // Check for awards
            const distinctionEl = await element.$(
              '.card__menu-content--distinction'
            );
            const awards: MichelinRestaurant['awards'] = {
              bibGourmand: false,
              greenStar: false,
              stars: 0,
            };
            const icons = (await distinctionEl?.$$('.michelin-award')) ?? [];
            for (const icon of icons) {
              // get the src of the icon
              const src = await icon.getAttribute('src');
              if (src) {
                if (src.includes('bib-gourmand')) {
                  awards.bibGourmand = true;
                } else if (src.includes('green-star')) {
                  awards.greenStar = true;
                } else if (src.includes('1star')) {
                  awards.stars = awards.stars ? awards.stars + 1 : 1;
                }
              }
            }

            if (name.trim()) {
              restaurants.push({
                name: name.trim(),
                cuisine: cuisine.trim(),
                awards,
                url,
                price: dollars as 1 | 2 | 3 | 4,
                coords,
              });
            }
          } catch (error) {
            console.warn('Error extracting restaurant data:', error);
          }
        }
      }

      return restaurants;
    } catch (error) {
      console.error('Error scraping restaurants:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new MichelinScraper();
  scraper
    .scrapeRestaurants()
    .then((restaurants) => {
      console.log(`\n✅ Found ${restaurants.length} restaurants:`);

      // Show first 10 restaurants with details
      restaurants.forEach((restaurant, index) => {
        console.log(
          `\n${index + 1}. ${restaurant.name} ${'$'.repeat(restaurant.price)}`
        );
        if (restaurant.cuisine) {
          console.log(`   🍽️  ${restaurant.cuisine}`);
        }
        if (restaurant.awards.stars > 0) {
          console.log(
            `   ${'⭐'.repeat(restaurant.awards.stars)} ${restaurant.awards.stars} Michelin star${restaurant.awards.stars > 1 ? 's' : ''}`
          );
        }
        if (restaurant.awards.bibGourmand) {
          console.log(`   🥇 Bib Gourmand`);
        }
        if (restaurant.awards.greenStar) {
          console.log(`   🌱 Green Star`);
        }
        if (restaurant.coords) {
          console.log(
            `   📍 (${restaurant.coords.lat}, ${restaurant.coords.lng})`
          );
        }
        console.log(`   🔗 ${restaurant.url}`);
      });
    })
    .catch(console.error);
}
