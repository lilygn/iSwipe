const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai/index.js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AXIOS_HEADERS = {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const scrapeGroup = async (url) => {
  const clubs = [];

  try {
    const res = await axios.get(url, AXIOS_HEADERS);
    const $ = cheerio.load(res.data);
    const elements = $('li.list-group-item').toArray();

    for (const [i, element] of elements.entries()) {
      const name = $(element).find('h2.media-heading a').text().trim();
      const relLink = $(element).find('h2.media-heading a').attr('href')?.trim();

      if (!relLink) {
        console.warn(`⚠️ Skipping ${name}: no relative link found.`);
        continue;
      }

      const fullLink = relLink.startsWith('http')
        ? relLink
        : `https://one.illinois.edu${relLink}`;

      console.log(`🔗 (${i + 1}/${elements.length}) Fetching ${name}: ${fullLink}`);

      let instagram = '';
      let facebook = '';

      try {
        const res2 = await axios.get(fullLink, AXIOS_HEADERS);
        const $$ = cheerio.load(res2.data);
        instagram = $$('a[href*="instagram.com"]').attr('href') || '';
        facebook = $$('a[href*="facebook.com"]').attr('href') || '';
      } catch (err) {
        if (err.response && err.response.status === 404) {
          console.warn(`Page not found for ${name}. Skipping socials.`);
        } else {
          console.error(`Could not fetch socials for ${name}: ${err.message}`);
        }
      }

      let description = '';
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You summarize UIUC student clubs in a short, engaging way.' },
            { role: 'user', content: `Write a short, fun 1-2 sentence description for the club '${name}' at UIUC.` }
          ],
          max_tokens: 80,
        });
        description = response.choices[0].message.content.trim();
      } catch (err) {
        console.error(`Failed to get description for ${name}: ${err.message}`);
        description = `No description available for ${name}.`;
      }

      clubs.push({ name, link: fullLink, instagram, facebook, description });

      await sleep(300); 
    }
  } catch (err) {
    console.error(`Failed scraping ${url}: ${err.message}`);
  }

  return clubs;
};

(async () => {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set in .env');
    process.exit(1);
  }

  const blueURL = 'https://one.illinois.edu/club_signup?view=all&group_type=86567&category_tags=';
  const orangeURL = 'https://one.illinois.edu/club_signup?view=all&group_type=86564&category_tags=';

  const blueClubs = await scrapeGroup(blueURL);
  const orangeClubs = await scrapeGroup(orangeURL);
  const allClubs = [...blueClubs, ...orangeClubs];

  const outputPath = path.resolve(__dirname, '../app/assets/all_rso_data.json');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(allClubs, null, 2));
  console.log(`Done! Collected ${allClubs.length} RSOs and saved to ${outputPath}`);
})();
