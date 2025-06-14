#!/usr/bin/env node

import readline from 'readline';
import { logger } from '../src/server/logger.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

let jsonOutput = '';

const QUALITY_THRESHOLD_MSG = 'Code quality is below the required threshold of 95/100';

rl.on('line', (line) => {
  jsonOutput += line;
});

rl.on('close', () => {
  try {
    const results = JSON.parse(jsonOutput);
    const score = calculateScore(results);
    printReport(score, results);

    // Exit with error if score is below threshold
    if (score.qualityScore < 95) {
      process.exit(1);
    }
  } catch (error) {
    logger.error('Error processing ESLint output:', error);
    process.exit(1);
  }
});

function calculateScore(results) {
  const totalIssues = results.reduce((sum, file) => sum + file.messages.length, 0);
  const errorCount = results.reduce((sum, file) =>
    sum + file.messages.filter((msg) => msg.severity === 2).length, 0);
  const warningCount = results.reduce((sum, file) =>
    sum + file.messages.filter((msg) => msg.severity === 1).length, 0);
  const filesAnalyzed = results.length;

  // Stricter scoring:
  // - Each error reduces score by 15 points (up from 10)
  // - Each warning reduces score by 5 points (up from 2)
  // - Maximum score is 100
  const qualityScore = Math.max(0, 100 - (errorCount * 15 + warningCount * 5));

  return {
    totalIssues,
    errorCount,
    warningCount,
    filesAnalyzed,
    qualityScore,
  };
}

function printReport(score, results) {
  const report = {
    title: 'Code Quality Report',
    score: {
      current: score.qualityScore,
      target: 95,
    },
    analysis: {
      totalIssues: score.totalIssues,
      errorCount: score.errorCount,
      warningCount: score.warningCount,
      filesAnalyzed: score.filesAnalyzed,
    },
  };

  logger.info(report, 'Code Quality Report');

  if (score.errorCount > 0) {
    const criticalIssues = results.flatMap((file) =>
      file.messages
        .filter((msg) => msg.severity === 2)
        .map((msg) => ({
          file: file.filePath,
          line: msg.line,
          column: msg.column,
          message: msg.message,
        })),
    );
    logger.error({ criticalIssues }, 'Critical Issues Found');
  }

  if (score.warningCount > 0) {
    const warnings = results.flatMap((file) =>
      file.messages
        .filter((msg) => msg.severity === 1)
        .map((msg) => ({
          file: file.filePath,
          line: msg.line,
          column: msg.column,
          message: msg.message,
        })),
    );
    logger.warn({ warnings }, 'Warnings Found');
  }

  if (score.qualityScore < 95) {
    logger.error(QUALITY_THRESHOLD_MSG);
    logger.info('Please fix the issues above to improve code quality.');
  } else {
    logger.info('Code quality meets the required threshold!');
  }
}
