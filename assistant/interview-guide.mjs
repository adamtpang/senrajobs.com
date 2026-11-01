import {profileCoverage} from './profile.mjs';
export const interviewSections=[
  {key:'direction',label:'Direction',question:'What kind of work do you want next, and what would make it a great move?'},
  {key:'experience',label:'Experience',question:'Walk me through your most relevant work. What did you own, for how long, and at what scale?'},
  {key:'skills',label:'Skills',question:'Which skills do you use best? Give me a recent example of using them independently.'},
  {key:'proof',label:'Results',question:'Tell me about a project or achievement you are proud of. What did you do, and what changed because of it?'},
  {key:'preferences',label:'Work environment',question:'What kind of company and working environment helps you do your best work?'},
  {key:'constraints',label:'Practical needs',question:'What practical requirements would a role need to meet, such as location, pay, work setup or your start date?'},
  {key:'learning',label:'Learning',question:'What do you most want to learn from your next role?'},
  {key:'tradeoffs',label:'Priorities',question:'If you had to choose, which matters most: learning, pay, ownership or flexibility? What would you trade for it?'}
];
export function interviewStep(profile) {
  const coverage=profileCoverage(profile),section=interviewSections.find(section=>coverage.missing.includes(section.key));
  return {coverage,section,index:section?interviewSections.indexOf(section):interviewSections.length};
}
export function interviewProgress(profile) {
  const step=interviewStep(profile),remaining=8-step.coverage.covered.length;
  return {...step,percent:Math.round(step.coverage.covered.length/8*100),eta:remaining?`About ${Math.max(1,Math.round(remaining*1.5))}–${Math.max(2,Math.round(remaining*1.9))} min remaining`:'Ready to review'};
}
