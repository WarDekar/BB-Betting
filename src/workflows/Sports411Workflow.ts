import { BaseSiteWorkflow } from './BaseSiteWorkflow.js';
import type { BrowserManager } from '../core/BrowserManager.js';
import type { SiteConfig, WorkflowResult } from '../types/index.js';

/**
 * Sports411 workflow for sports411.ag betting site.
 *
 * Site structure (as of Dec 2024):
 * - Login: #account (username), #password (password), input.btn.login (submit)
 * - Logged in: Account number visible in header, balance dropdown present
 * - History: /en/history (Angular SPA - navigate via History link)
 */
export class Sports411Workflow extends BaseSiteWorkflow {
  static readonly DEFAULT_URL = 'https://sports411.ag';

  constructor(config: SiteConfig, manager: BrowserManager) {
    super(
      {
        ...config,
        baseUrl: config.baseUrl || Sports411Workflow.DEFAULT_URL,
      },
      manager
    );
  }

  /**
   * Check if user is logged in.
   *
   * When logged in:
   * - Account number visible in header
   * - Balance dropdown present
   * - Login form is hidden/gone
   */
  async isLoggedIn(): Promise<boolean> {
    const page = this.getPage();

    // Check if we're on the login page (has Account Login form)
    const hasLoginForm = await this.exists('input[placeholder="Account"], input[name="account"]');
    const hasLoginButton = await this.exists('button:has-text("LOG IN"), input[value="LOG IN"]');

    if (hasLoginForm || hasLoginButton) {
      return false;
    }

    // If no login form visible, assume logged in
    // Also check URL - if not on login page, likely logged in
    const url = page.url();
    if (url.includes('/en/') && !url.endsWith('.ag/')) {
      return true;
    }

    return true;
  }

  /**
   * Login with credentials.
   */
  async login(): Promise<WorkflowResult<void>> {
    const page = this.getPage();

    // Check if already logged in
    if (await this.isLoggedIn()) {
      return { success: true, timestamp: new Date() };
    }

    const username = (this.config as SiteConfig & { username?: string }).username;
    const password = (this.config as SiteConfig & { password?: string }).password;

    if (username && password) {
      try {
        console.log(`🔐 Attempting auto-login for ${this.config.name}...`);

        // Find and fill account field (try multiple selectors)
        const accountSelectors = ['input[placeholder="Account"]', 'input[name="account"]', '#account'];
        for (const sel of accountSelectors) {
          if (await this.exists(sel)) {
            await this.type(sel, username);
            break;
          }
        }

        // Random delay to avoid rate limiting
        await this.randomDelay(1200, 2500);

        // Find and fill password field
        const passSelectors = ['input[placeholder="Password"]', 'input[name="password"]', '#password', 'input[type="password"]'];
        for (const sel of passSelectors) {
          if (await this.exists(sel)) {
            await this.type(sel, password);
            break;
          }
        }

        // Random delay before clicking
        await this.randomDelay(800, 1800);

        // Click login button (try multiple selectors)
        const loginBtnSelectors = ['button:has-text("LOG IN")', 'input[value="LOG IN"]', 'input.btn.login', '.login-btn'];
        for (const sel of loginBtnSelectors) {
          if (await this.exists(sel)) {
            await this.click(sel);
            break;
          }
        }

        // Wait for login to complete (random delay)
        await this.randomDelay(3000, 5000);

        // Save session regardless - if login worked, session is valid
        await this.saveSession();
        console.log(`✅ Login submitted for ${this.config.name}`);
        return { success: true, timestamp: new Date() };

      } catch (err) {
        console.log(`⚠️ Auto-login error: ${(err as Error).message}`);
        return { success: false, error: (err as Error).message, timestamp: new Date() };
      }
    }

    // No credentials - return error, don't fall back to manual login
    return { success: false, error: 'No credentials provided', timestamp: new Date() };
  }

  /**
   * Get bet history for a date range.
   */
  async getBetHistory(
    fromDate?: Date,
    toDate?: Date
  ): Promise<WorkflowResult<any[]>> {
    try {
      const page = this.getPage();

      if (!(await this.isLoggedIn())) {
        return this.result(false, [], 'Not logged in. Call login() first.');
      }

      // Click History link
      await this.click('text=History');
      await this.sleep(2000);

      // Set date range if provided
      if (fromDate && toDate) {
        const fromStr = fromDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const toStr = toDate.toISOString().split('T')[0];

        await page.evaluate(
          ([from, to]) => {
            const startInput = document.querySelector('#start') as HTMLInputElement;
            const endInput = document.querySelector('#end') as HTMLInputElement;
            if (startInput) startInput.value = from;
            if (endInput) endInput.value = to;
            startInput?.dispatchEvent(new Event('change', { bubbles: true }));
            endInput?.dispatchEvent(new Event('change', { bubbles: true }));
          },
          [fromStr, toStr]
        );

        await this.click('button:has-text("Custom Range")');
        await this.sleep(2000);
      }

      // Scrape all pages
      const allBets: any[] = [];
      let hasNextPage = true;

      while (hasNextPage) {
        const bets = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('app-history-ticket .ticket')).map((t) => {
            const ticketMatch = t.querySelector('.date-data')?.textContent?.match(/Ticket # (\d+)/);
            const dateMatch = t.querySelector('.date-data')?.textContent?.match(/(\d+\/\d+)@(\d+:\d+ [AP]M)/);
            return {
              betId: ticketMatch?.[1] || null,
              betType: t.querySelector('.bet-type')?.textContent?.trim(),
              selection: t.querySelector('.game')?.textContent?.trim()?.replace(/\n/g, ' '),
              date: dateMatch?.[1] || null,
              time: dateMatch?.[2] || null,
              riskWin: t.querySelectorAll('.col-2 .amount')[0]?.textContent?.trim(),
              winLoss: t.querySelectorAll('.col-2 .amount')[1]?.textContent?.trim(),
              site: 'sports411',
              scrapedAt: new Date().toISOString(),
            };
          });
        });

        allBets.push(...bets);

        // Check for next page
        const nextBtn = await page.$('#nextBtn a:not(.disabled)');
        if (nextBtn) {
          await nextBtn.click();
          await this.sleep(1500);
        } else {
          hasNextPage = false;
        }
      }

      return this.result(true, allBets);
    } catch (err) {
      return this.result(false, [], (err as Error).message);
    }
  }
}
