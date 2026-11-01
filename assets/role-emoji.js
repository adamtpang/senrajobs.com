export function roleEmoji(title) {
  const text = title.toLowerCase();
  if (/\b(design|designer|creative|animator|animation|artist)\b/.test(text)) return '🎨';
  if (/\b(legal|counsel|attorney|lawyer|paralegal)\b/.test(text)) return '⚖️';
  if (/\b(nurse|doctor|physician|clinician|clinical|medical|healthcare)\b/.test(text)) return '🩺';
  if (/\b(recruiter|recruiting|recruitment|talent|people|hr)\b/.test(text)) return '👥';
  if (/\b(finance|financial|accountant|accounting|payroll|controller|tax|treasury)\b/.test(text)) return '💰';
  if (/\b(marketing|growth|communications|content|brand|copywriter|writer|editor)\b/.test(text)) return '📣';
  if (/\b(sales|account|partnerships|business development|customer success)\b/.test(text)) return '🤝';
  if (/\b(chef|cook|kitchen|restaurant|server|bartender|food)\b/.test(text)) return '🍽️';
  if (/\b(retail|store|merchandising|stylist|cashier)\b/.test(text)) return '🛍️';
  if (/\b(research|scientist|science|laboratory|biologist|chemist)\b/.test(text)) return '🔬';
  if (/\b(hardware|mechanical|electrical|electrician|manufacturing|technician|maintenance)\b/.test(text)) return '🔧';
  if (/\b(technology|tech|software|developer|data|frontend|backend|full.?stack|infrastructure|security|it|machine learning|ai)\b/.test(text)) return '💻';
  if (/\b(engineer|engineering)\b/.test(text)) return '🛠️';
  if (/\b(operations|logistics|supply chain|warehouse|procurement)\b/.test(text)) return '⚙️';
  if (/\b(intern|internship|apprentice)\b/.test(text)) return '🌱';
  return '💼';
}
