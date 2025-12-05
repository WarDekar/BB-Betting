import { BaseSiteWorkflow } from './BaseSiteWorkflow.js';
import type { BrowserManager } from '../core/BrowserManager.js';
import type { SiteConfig, WorkflowResult } from '../types/index.js';

/**
 * BetOnline workflow for betonline.ag betting site.
 *
 * Site structure (as of Dec 2024):
 * - Login: Click LOGIN button -> fill #username, #password -> click #kc-login
 * - Dismiss Popups: Click "GOT IT" for promotional popups
 * - Logged in: Balance visible in header, account dropdown available
 * - History: Click balance -> "Bet History" (Angular app with infinite scroll)
 */
export class BetOnlineWorkflow extends BaseSiteWorkflow {
  static readonly DEFAULT_URL = 'https://www.betonline.ag';

  constructor(config: SiteConfig, manager: BrowserManager) {
    super(
      {
        ...config,
        baseUrl: config.baseUrl || BetOnlineWorkflow.DEFAULT_URL,
      },
      manager
    );
  }

  /**
   * Check if user is logged in.
   */
  async isLoggedIn(): Promise<boolean> {
    // Check for logged-OUT indicators (login button present)
    const hasLoginBtn = await this.exists('button:has-text("LOGIN"), a:has-text("LOGIN")');
    const hasKcLogin = await this.exists('#kc-login');

    if (hasLoginBtn || hasKcLogin) {
      return false;
    }

    // Check for logged-in indicators
    const hasBalance = await this.exists('[class*="balance"], [class*="account-info"]');
    return hasBalance;
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

        // Click LOGIN button to open login form
        const loginBtn = await page.$('button:has-text("LOGIN"), a:has-text("LOGIN")');
        if (loginBtn) {
          await loginBtn.click();
          await this.randomDelay(1500, 2500);
        }

        // Fill username
        await this.waitFor('#username', 5000);
        await this.type('#username', username);

        // Random delay to avoid rate limiting
        await this.randomDelay(1200, 2500);

        // Fill password
        await this.type('#password', password);

        // Random delay before checking captcha/clicking
        await this.randomDelay(800, 1800);

        // Check for reCAPTCHA before clicking login
        const hasRecaptcha = await this.exists('iframe[src*="recaptcha"], .g-recaptcha, #recaptcha');
        if (hasRecaptcha) {
          console.log(`🔒 reCAPTCHA detected - waiting for manual solve...`);
          // Wait up to 60 seconds for user to solve captcha
          const captchaTimeout = 60000;
          const startTime = Date.now();

          while (Date.now() - startTime < captchaTimeout) {
            // Check if captcha is solved (recaptcha response exists)
            const solved = await page.evaluate(() => {
              const response = (window as any).grecaptcha?.getResponse?.();
              return response && response.length > 0;
            }).catch(() => false);

            if (solved) {
              console.log(`✅ reCAPTCHA solved!`);
              break;
            }

            // Also check if we're already logged in (user clicked submit)
            if (await this.isLoggedIn()) {
              await this.saveSession();
              return { success: true, timestamp: new Date() };
            }

            await this.sleep(2000);
          }
        }

        // Click login submit
        await this.click('#kc-login');

        // Wait for login to complete (random delay)
        await this.randomDelay(2500, 4000);

        // Dismiss any popups (GOT IT button)
        try {
          const gotItBtn = await page.$('button:has-text("GOT IT")');
          if (gotItBtn) {
            await gotItBtn.click();
            await this.randomDelay(400, 800);
          }
        } catch {
          // No popup, continue
        }

        // Save session
        await this.saveSession();
        console.log(`✅ Login submitted for ${this.config.name}`);
        return { success: true, timestamp: new Date() };

      } catch (err) {
        console.log(`⚠️ Auto-login error: ${(err as Error).message}`);
        return { success: false, error: (err as Error).message, timestamp: new Date() };
      }
    }

    // No credentials
    return { success: false, error: 'No credentials provided', timestamp: new Date() };
  }

  /**
   * Get bet history.
   * Note: BetOnline uses infinite scroll, user should set date range manually.
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

      // Navigate to Bet History via account dropdown
      await this.click('[class*="balance"], [class*="account-info"]');
      await this.sleep(1000);

      await this.click('text=Bet History');
      await this.sleep(2000);

      // Scroll to load bets (infinite scroll)
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.sleep(800);
      }

      // Scrape bet data
      const bets = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.bet-history__table__body__rows')).map((row) => {
          const cols = row.querySelectorAll('.bet-history__table__body__rows__columns > div');
          const ticketEl = cols[0];
          const dateEl = cols[1];
          const descEl = cols[2];
          const statusEl = cols[4];
          const amountEl = cols[5];
          const toWinEl = cols[6];

          const amountText = amountEl?.textContent?.trim() || '';
          const amounts = amountText.match(/\$[\d,]+\.\d+/g) || [];

          return {
            betId: ticketEl?.textContent?.trim()?.replace(/[^\d-]/g, ''),
            date: dateEl?.textContent?.trim(),
            description: descEl?.textContent?.trim(),
            betType: statusEl?.textContent?.trim(),
            status: amountEl?.textContent?.includes('Won')
              ? 'Won'
              : amountEl?.textContent?.includes('Lost')
              ? 'Lost'
              : amountEl?.textContent?.includes('Cancel')
              ? 'Cancelled'
              : 'Pending',
            stake: amounts[0] || '',
            toWin: toWinEl?.textContent?.match(/\$[\d,]+\.\d+/)?.[0] || '',
            site: 'betonline',
            scrapedAt: new Date().toISOString(),
          };
        });
      });

      return this.result(true, bets);
    } catch (err) {
      return this.result(false, [], (err as Error).message);
    }
  }
}
