import { type Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }
}
