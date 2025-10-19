export const REPORT_TRANSLATIONS = Object.freeze({
  ja: {
    labelTitle: 'アクセシビリティレポート',
    labelViolations: '検出された問題',
    labelFailureMessage: '失敗メッセージ',
    labelFailureSummary: '概要',
    labelImgAlt: 'ページのスクリーンショット',
    labelTargetHTML: '対象 HTML',
    labelHelpPage: '関連情報',
    labelNoIssues: '自動検出の問題はありません。',
    labelImpact: '影響度',
    impactData: Object.freeze({
      minor: '軽度',
      moderate: '中程度',
      serious: '重大',
      critical: '緊急'
    }),
    labelViolationFilter: '影響度フィルター',
    labelViolationFilterNote: '（チェックを外すと該当する影響度の問題を非表示にします）',
    labelViolationFilterReset: 'フィルターをリセット',
    labelViolationFilterResetAriaLabel: '影響度フィルターをリセットして全ての問題を表示',
    labelViolationTableHeader: 'チェック操作',
    labelViolationTableCheckAll: 'すべてチェック',
    labelViolationTableUncheckAll: 'すべてのチェックを解除',
    labelRule: 'ルール',
    labelViolationIssueCount: '問題数',
    labelSeeMore: 'さらに表示'
  },
  en: {
    labelTitle: 'Accessibility Report',
    labelViolations: 'Test Result',
    labelFailureMessage: 'Failure Message',
    labelFailureSummary: 'Failure Summary',
    labelImgAlt: 'Screenshot of the page',
    labelTargetHTML: 'Target HTML',
    labelHelpPage: 'More Information',
    labelNoIssues: 'You have (0) automatic issues, nice!',
    labelImpact: 'Impact',
    impactData: Object.freeze({
      minor: 'Minor',
      moderate: 'Moderate',
      serious: 'Serious',
      critical: 'Critical'
    }),
    labelViolationFilter: 'Impact Filter',
    labelViolationFilterNote: '(Uncheck to hide failures of the corresponding impact level)',
    labelViolationFilterReset: 'Reset Filter',
    labelViolationFilterResetAriaLabel: 'Reset the impact filter to display all failures.',
    labelViolationTableHeader: 'Selection',
    labelViolationTableCheckAll: 'Check all',
    labelViolationTableUncheckAll: 'Uncheck all',
    labelRule: 'Rule',
    labelViolationIssueCount: 'Issues',
    labelSeeMore: 'See more'
  }
});

export default REPORT_TRANSLATIONS;
