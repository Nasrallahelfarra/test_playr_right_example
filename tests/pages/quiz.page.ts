import { type Page } from '@playwright/test';

export class QuizPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }
}
