const puppeteer = require('puppeteer');
const Job = require('../models/Job');

class JobScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      
      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log('Puppeteer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Puppeteer:', error);
      throw error;
    }
  }

  async scrapeJobs(url, selectors) {
    try {
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for job listings to load
      await this.page.waitForSelector(selectors.jobContainer, { timeout: 10000 }).catch(() => {
        console.log('Job container selector not found, continuing...');
      });

      const jobs = await this.page.evaluate((selectors) => {
        const jobElements = document.querySelectorAll(selectors.jobContainer);
        const scrapedJobs = [];

        jobElements.forEach((element) => {
          try {
            const title = element.querySelector(selectors.title)?.textContent?.trim();
            const company = element.querySelector(selectors.company)?.textContent?.trim();
            const description = element.querySelector(selectors.description)?.textContent?.trim();
            const email = element.querySelector(selectors.email)?.textContent?.trim() || 
                         element.querySelector(selectors.email)?.href?.match(/mailto:([^?]+)/)?.[1];
            const location = element.querySelector(selectors.location)?.textContent?.trim();
            const salary = element.querySelector(selectors.salary)?.textContent?.trim();

            if (title && company && description && email) {
              scrapedJobs.push({
                title,
                company,
                description,
                email,
                location,
                salary
              });
            }
          } catch (error) {
            console.log('Error processing job element:', error);
          }
        });

        return scrapedJobs;
      }, selectors);

      return jobs;
    } catch (error) {
      console.error('Error scraping jobs:', error);
      return [];
    }
  }

  async scrapeGenericJobBoards() {
    const jobBoards = [
      {
        url: 'https://example-job-board.com',
        selectors: {
          jobContainer: '.job-listing',
          title: '.job-title',
          company: '.company-name',
          description: '.job-description',
          email: '.contact-email',
          location: '.job-location',
          salary: '.job-salary'
        }
      }
    ];

    const allJobs = [];

    for (const board of jobBoards) {
      try {
        console.log(`Scraping ${board.url}...`);
        const jobs = await this.scrapeJobs(board.url, board.selectors);
        allJobs.push(...jobs);
        console.log(`Found ${jobs.length} jobs from ${board.url}`);
      } catch (error) {
        console.error(`Error scraping ${board.url}:`, error);
      }
    }

    return allJobs;
  }

  async scrapeLinkedInJobs(keyword, location) {
    try {
      const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}`;
      
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for job results
      await this.page.waitForSelector('.jobs-search__results-list', { timeout: 10000 });
      
      const jobs = await this.page.evaluate(() => {
        const jobElements = document.querySelectorAll('.jobs-search__results-list li');
        const scrapedJobs = [];

        jobElements.forEach((element) => {
          try {
            const title = element.querySelector('.job-card-list__title')?.textContent?.trim();
            const company = element.querySelector('.job-card-container__company-name')?.textContent?.trim();
            const location = element.querySelector('.job-card-container__metadata-item')?.textContent?.trim();
            
            // LinkedIn doesn't show emails directly, but we can try to extract from job details
            const description = element.querySelector('.job-card-list__description')?.textContent?.trim();
            
            // Look for email patterns in description
            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
            const emails = description?.match(emailRegex) || [];

            if (title && company && description && emails.length > 0) {
              scrapedJobs.push({
                title,
                company,
                description,
                email: emails[0], // Take the first email found
                location,
                sourceUrl: window.location.href
              });
            }
          } catch (error) {
            console.log('Error processing LinkedIn job element:', error);
          }
        });

        return scrapedJobs;
      });

      return jobs;
    } catch (error) {
      console.error('Error scraping LinkedIn jobs:', error);
      return [];
    }
  }

  async saveJobsToDatabase(jobs) {
    let savedCount = 0;
    let skippedCount = 0;

    for (const jobData of jobs) {
      try {
        // Check if job already exists (prevent duplicates)
        const existingJob = await Job.findOne({
          title: jobData.title,
          company: jobData.company,
          email: jobData.email
        });

        if (!existingJob) {
          const job = new Job({
            ...jobData,
            source: 'scraper'
          });
          
          await job.save();
          savedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error('Error saving job to database:', error);
      }
    }

    console.log(`Saved ${savedCount} jobs, skipped ${skippedCount} duplicates`);
    return { savedCount, skippedCount };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Puppeteer browser closed');
    }
  }
}

module.exports = JobScraper;