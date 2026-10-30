import { createHash } from 'node:crypto';
import { ReadingCheckContentSchema, type TextDetail } from '@lingoup/contracts';

// Original comprehension exercises for the project's CC0 reading texts.
const CATALOG: Record<string, { hash: string; content: unknown }> = {
  'a1-morning-routine': {
    hash: 'b84789132a53d2e2c19c6104e049fe3844ef5ec414615bd3228058085794fbc2',
    content: {
      questions: [
        {
          question: 'Where does Tom work?',
          options: ['In a bookshop', 'In a hospital', 'At a school', 'In a cafe'],
          answerIndex: 0,
          explanation: 'Tom tells us his job at the start of the text.',
          evidence: 'I work in a bookshop.',
        },
        {
          question: 'What does Tom drink with breakfast?',
          options: ['Orange juice', 'Coffee', 'Tea', 'Milk'],
          answerIndex: 2,
          explanation: 'Tom eats bread with cheese and drinks tea.',
          evidence: 'I eat bread with cheese and I drink a cup of tea.',
        },
        {
          question: 'What time does Tom leave home?',
          options: ['At seven', 'At half past seven', 'At ten past eight', 'At eight'],
          answerIndex: 3,
          explanation:
            'Leaving home and catching the bus happen at different times. He leaves at eight.',
          evidence: "I leave home at eight o'clock.",
        },
      ],
    },
  },
  'a2-weekend-market': {
    hash: 'e0c4fc34300f043226332074888b4dd2be1e5448c58f50158759717faa4b4634',
    content: {
      questions: [
        {
          question: 'Who goes to the market with Maria?',
          options: ['Her brother', 'Her grandmother', 'Her teacher', 'Her neighbour'],
          answerIndex: 1,
          explanation: 'The first sentence names the person who goes with Maria.',
          evidence: 'Maria goes to the market with her grandmother.',
        },
        {
          question: 'Why do they wait until the end of the morning to buy fruit?',
          options: [
            'The fruit is cheaper then',
            'The market opens at midday',
            'Maria has no money earlier',
            'The sellers bring new fruit then',
          ],
          answerIndex: 0,
          explanation:
            'The sellers lower their prices because they do not want to take the fruit home.',
          evidence: "The sellers don't want to take it home, so the prices are lower.",
        },
        {
          question: 'What does Maria carry on the way home?',
          options: ['The vegetables', 'The flowers', 'The strawberries', 'The bread'],
          answerIndex: 2,
          explanation:
            'They share the heavy bags: Maria takes the strawberries and her grandmother takes the vegetables.',
          evidence: 'Maria carries the strawberries and her grandmother carries the vegetables.',
        },
      ],
    },
  },
  'b1-learning-to-cycle': {
    hash: '3c69dee6c8a8ff3dc9c61620ad08558a503d45ae6c67279ab680f8bdadb8f119',
    content: {
      questions: [
        {
          question: 'Why did the narrator not learn to cycle as a child?',
          options: [
            'The family could not afford a bike',
            'There was no safe place to ride',
            'The narrator disliked outdoor activities',
            'The school did not offer lessons',
          ],
          answerIndex: 1,
          explanation: 'The narrator links not learning directly to the unsafe surroundings.',
          evidence: 'There was nowhere safe to ride a bike, so I never learnt.',
        },
        {
          question:
            'What was the purpose of pushing the ground with their feet in the first lesson?',
          options: [
            'To learn how to repair a bike',
            'To train for a race',
            'To practise balance before pedalling',
            'To practise travelling uphill',
          ],
          answerIndex: 2,
          explanation:
            'The exercise helped the narrator discover the small corrections needed to keep balance.',
          evidence:
            "But slowly I started to understand what balance actually feels like: you don't stay still, you keep making tiny corrections.",
        },
        {
          question: 'What is the most important change in the narrator by the end?',
          options: [
            'A belief that learning new skills is still possible',
            'A wish to teach professional cyclists',
            'A decision to stop commuting',
            'A preference for avoiding difficult tasks',
          ],
          answerIndex: 0,
          explanation:
            'The story ends with a change in attitude to learning, beyond the shorter journey.',
          evidence: 'More importantly, I have stopped saying "I\'m too old for that."',
        },
      ],
    },
  },
  'b2-four-day-week': {
    hash: 'f9d57b766b0fbdbf2acc01102019272099c0c8ea2830129ac332c68288bbea37',
    content: {
      questions: [
        {
          question: 'Which benefit was reported by several organisations running trials?',
          options: [
            'Every employee worked longer hours',
            'Output doubled in every trial',
            'Salaries fell',
            'Output stayed similar while sick days fell',
          ],
          answerIndex: 3,
          explanation:
            'The reported advantage was maintaining output alongside better staff outcomes, rather than a universal increase in output.',
          evidence: 'output stayed roughly the same, while sick days and staff turnover fell.',
        },
        {
          question: 'Why does the author mention hospitals, schools and restaurants?',
          options: [
            'To argue that all workplaces should close on Fridays',
            'To show that providing continuous services can make a shorter week costly',
            'To prove office work is less valuable',
            'To claim that all trials involved these services',
          ],
          answerIndex: 1,
          explanation:
            'These examples challenge whether results from reorganised office work apply to services that must stay open.',
          evidence:
            'it would need to hire more staff to cover the same hours, which raises costs considerably.',
        },
        {
          question: "Which conclusion best reflects the author's position?",
          options: [
            'The four-day week is unsuitable for every business',
            'Working hours are the only reliable measure of value',
            'Success depends on redesigning work and considering the setting',
            'A shorter week always increases stress',
          ],
          answerIndex: 2,
          explanation:
            'The author presents a conditional argument: implementation and context matter.',
          evidence: 'the results seem to depend on how the change is introduced.',
        },
      ],
    },
  },
  'c1-memory-and-forgetting': {
    hash: 'd86d71114affed55612178f0111b064c5aabfe08ad222c0e575d2d62e88a90be',
    content: {
      questions: [
        {
          question: 'What makes retrieval a desirable difficulty?',
          options: [
            'It strengthens a fading memory through effort',
            'It makes every review immediately comfortable',
            'It prevents all forgetting permanently',
            'It replaces the need to practise',
          ],
          answerIndex: 0,
          explanation:
            'The difficulty is useful because the act of retrieving a weakening memory strengthens it.',
          evidence:
            'that act of retrieval strengthens it far more than rereading the same material would.',
        },
        {
          question: 'Why can repeated reading in one evening be misleading?',
          options: [
            'It removes all familiarity with the material',
            'It always makes information harder to recognise',
            'It guarantees long-term recall',
            'Familiarity can feel like learning while requiring little retrieval effort',
          ],
          answerIndex: 3,
          explanation:
            'The author distinguishes a comforting feeling of familiarity from the effort that supports later retention.',
          evidence: 'the information is still fresh, so each repetition requires almost no effort',
        },
        {
          question: 'What does the final paragraph imply about feeling unsure during review?',
          options: [
            'It proves the scheduler is broken',
            'It can be part of effective learning rather than evidence of failure',
            'It means the learner should only review easy items',
            'It shows spaced practice is equivalent to cramming',
          ],
          answerIndex: 1,
          explanation:
            'The closing argument reframes productive struggle as compatible with learning.',
          evidence: 'The feeling of struggling is not a sign that you are failing to learn',
        },
      ],
    },
  },
  'c2-the-cartographers-dilemma': {
    hash: 'aab75718d54735ffacd763926822fa22b03bbe557b9b3875bc03c1c7ce272d70',
    content: {
      questions: [
        {
          question: "What does the empire's full-scale map illustrate?",
          options: [
            'A representation should preserve every detail to be useful',
            'Mapmaking has no practical value',
            'Accuracy alone does not make a representation useful',
            'All forms of abstraction are dishonest',
          ],
          answerIndex: 2,
          explanation:
            'The apparently perfect map is unusable, illustrating why selective representation matters.',
          evidence: 'a representation is valuable precisely because of what it leaves out.',
        },
        {
          question: 'Why does the author compare grammar tables with economic equations?',
          options: [
            'To show how useful abstractions can be mistaken for the richer realities they describe',
            'To prove that both subjects have identical rules',
            'To recommend memorising tables as the sole route to fluency',
            'To claim that all models should be abandoned',
          ],
          answerIndex: 0,
          explanation:
            'Both examples illustrate the danger of confusing a model with the reality it simplifies.',
          evidence: 'we begin to treat it as the territory rather than a sketch of it.',
        },
        {
          question: 'Which attitude does the conclusion advocate?',
          options: [
            'Confidence that a sufficiently detailed model eliminates all uncertainty',
            'Refusing to use any model because each is incomplete',
            'Treating established representations as final',
            'Using and revising models while recognising their limits',
          ],
          answerIndex: 3,
          explanation:
            'The proposed humility involves continuing to use maps while replacing those that mislead us.',
          evidence: 'to use maps constantly, to draw new ones whenever the old ones mislead us',
        },
      ],
    },
  },
};

export function authoredReadingCheck(text: TextDetail) {
  const saved = CATALOG[text.slug];
  if (
    text.isPrivate ||
    !saved ||
    saved.hash !== createHash('sha256').update(text.paragraphs.join('\n\n')).digest('hex')
  )
    return null;
  return ReadingCheckContentSchema.parse(saved.content);
}
