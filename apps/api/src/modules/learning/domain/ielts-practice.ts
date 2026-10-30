/** Original short-form IELTS-style materials. Answers and transcripts stay on the server. */
export const READING = [
  {
    title: 'Cooling the city',
    text: 'A city council planted trees beside two similar roads. On one road, young trees were widely spaced; on the other, mature trees formed a continuous canopy. Researchers measured surface temperatures at midday for six weeks in July and August. The shaded road was cooler, but air temperature changed less than the temperature of the pavement. Trees also need water, and species with shallow roots may damage paths. The researchers recommend choosing species suited to local rainfall rather than simply planting the fastest-growing trees. Their study did not measure winter conditions or changes in household electricity use.',
  },
  {
    title: 'Learning from mistakes',
    text: 'In a university experiment, two groups studied unfamiliar scientific terms. Both had the same total study time. One group reread definitions; the other tried to recall each definition before seeing the answer. The recall group made more mistakes during practice but remembered more terms a week later. Receiving feedback after an attempted answer was essential: guessing without feedback offered little benefit. The authors warn that the results concern remembering terms, not mastering every scientific skill. They suggest that short quizzes should be used as learning tools rather than only as final assessments.',
  },
  {
    title: 'Repairing instead of replacing',
    text: 'Community repair workshops invite residents to bring damaged household objects. Volunteers offer tools and advice, while owners take part in the repair. A survey of three workshops found that electrical appliances were the most frequent items, followed by clothing. Some objects could not be repaired because spare parts were unavailable. Participants often valued meeting neighbours as much as saving money. However, the survey included only people who had attended a workshop. It therefore cannot show whether the wider population would prefer repair to replacement. The organisers plan to interview non-participants before opening further locations.',
  },
] as const;
export const TRANSCRIPTS = [
  'Receptionist: Welcome to the city learning centre. The evening photography course starts on the twelfth of May, not the fifth as our old leaflet says. Classes meet on Tuesday from six until eight. The total fee is eighty pounds, including equipment. Please register at the reception desk before Friday. Student: Should I bring a camera? Receptionist: No, we provide one. Just bring a notebook.',
  'Welcome to the Riverside Museum. The main entrance is beside the bridge. Visitors with bicycles should use the racks behind the cafe, not the small car park. The exhibition about local transport is on the first floor. Entry to the museum is free, but the guided tour costs four pounds. The final tour begins at three thirty. Our cafe closes half an hour after the last tour starts.',
  'Tutor: Your project on library use has a clear research question. How many students will you interview? Student: We planned fifty, but our timetable only allows thirty. Tutor: That is reasonable. Avoid interviewing only your friends. Student: We will recruit volunteers from three different departments. Tutor: Good. In your presentation, explain how you selected participants before describing the results. Leave time for the limitations at the end.',
  'Today we will consider water use on farms. Sensors can measure moisture near plant roots and help farmers decide when to irrigate. In a trial, sensor-based irrigation used twenty percent less water than a fixed schedule. Crop yield stayed almost the same. The equipment was expensive at first, although maintenance costs were low. The researchers stress that savings depend on soil and weather: the same reduction should not be expected on every farm.',
] as const;
const q = (section: number, prompt: string, options: string[], answer: number) => ({
  section,
  prompt,
  options,
  answer,
});
export const READING_QUESTIONS = [
  q(
    0,
    'When were measurements taken?',
    ['At midday in summer', 'At night in winter', 'Throughout an entire year', 'Only during rain'],
    0,
  ),
  q(
    0,
    'What changed more under the canopy?',
    ['Air temperature', 'Pavement temperature', 'Rainfall', 'Traffic speed'],
    1,
  ),
  q(
    0,
    'What do the researchers recommend?',
    [
      'The fastest-growing species',
      'Removing shallow-rooted trees everywhere',
      'Species suited to local rainfall',
      'Using only young trees',
    ],
    2,
  ),
  q(0, 'The study measured household electricity use.', ['True', 'False', 'Not given'], 1),
  q(
    1,
    'Which group remembered more after a week?',
    ['The rereading group', 'Both groups equally', 'The recall group', 'The text does not say'],
    2,
  ),
  q(
    1,
    'What was essential after guessing?',
    ['A longer break', 'Receiving feedback', 'Studying alone', 'Reading a new chapter'],
    1,
  ),
  q(1, 'The findings apply to every scientific skill.', ['True', 'False', 'Not given'], 1),
  q(
    2,
    'Who takes part in repairing objects?',
    [
      'Only paid technicians',
      'Only workshop organisers',
      'Owners with volunteers',
      'Manufacturers only',
    ],
    2,
  ),
  q(
    2,
    'Why were some repairs impossible?',
    [
      'Spare parts were unavailable',
      'Owners refused to help',
      'Tools were never provided',
      'The workshops charged too much',
    ],
    0,
  ),
  q(
    2,
    'What limits the survey?',
    [
      'It covered only workshop attendees',
      'It included too many locations',
      'It excluded appliances',
      'It measured only electricity',
    ],
    0,
  ),
];
export const LISTENING_QUESTIONS = [
  q(0, 'On which date does the course start?', ['5 May', '12 May', '15 May', '20 May'], 1),
  q(
    0,
    'When are the classes?',
    ['Monday morning', 'Tuesday 6–8 p.m.', 'Friday 6–8 p.m.', 'Tuesday 8–10 p.m.'],
    1,
  ),
  q(
    0,
    'What should the student bring?',
    ['A camera', 'Eighty photographs', 'A notebook', 'A laptop'],
    2,
  ),
  q(
    1,
    'Where are the bicycle racks?',
    ['Beside the bridge', 'In the car park', 'Behind the cafe', 'On the first floor'],
    2,
  ),
  q(
    1,
    'What costs four pounds?',
    ['Museum entry', 'The guided tour', 'Parking', 'The transport exhibition'],
    1,
  ),
  q(1, 'When does the cafe close?', ['3:00', '3:30', '4:00', '4:30'], 2),
  q(2, 'How many students will be interviewed?', ['20', '30', '40', '50'], 1),
  q(
    2,
    'What should come before the results in the presentation?',
    ['Study limitations', 'A list of friends', 'Participant selection', 'A budget proposal'],
    2,
  ),
  q(
    3,
    'How much less water did the trial use?',
    ['10 percent', '20 percent', '30 percent', '50 percent'],
    1,
  ),
  q(
    3,
    'Which statement reflects the research?',
    [
      'Crop yield doubled',
      'Every farm will save the same amount',
      'Maintenance was the largest expense',
      'Savings depend on soil and weather',
    ],
    3,
  ),
];
export const WRITING_TASKS = [
  'Academic Task 1. The table gives the percentage of students using three ways to travel to one university in 2010 and 2025. Bus: 2010 40%, 2025 30%. Bicycle: 2010 15%, 2025 35%. Car: 2010 45%, 2025 35%. Summarise the information, select the main features and make relevant comparisons. Write at least 150 words. Suggested time: 20 minutes.',
  'Academic Task 2. Some people believe universities should focus on practical skills for employment. Others believe they should focus on academic knowledge. Discuss both views and give your own opinion. Use reasons and relevant examples. Write at least 250 words. Suggested time: 40 minutes.',
];
export const SPEAKING_TASKS = [
  'Part 1 — Introduction. Do you work or study? What do you enjoy about it? What would you like to change? Answer aloud.',
  'Part 2 — Long turn. Describe a useful skill you learned. Say what the skill is, when and how you learned it, and why it is useful. Prepare for one minute, then speak for up to two minutes.',
  'Part 3 — Discussion. How has technology changed the way people learn? Is learning from mistakes important? Who should decide which skills students study? Explain your opinions.',
];

export function objectiveScore(answers: number[], questions: typeof READING_QUESTIONS) {
  return questions.reduce(
    (score, question, index) => score + Number(answers[index] === question.answer),
    0,
  );
}
export function practiceScore(
  reading: number,
  listening: number,
  writingBand: number,
  speakingBand: number,
) {
  return Math.round(
    ((reading / 10 + listening / 10 + writingBand / 9 + speakingBand / 9) / 4) * 100,
  );
}
