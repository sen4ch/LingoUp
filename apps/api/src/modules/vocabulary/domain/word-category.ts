import type { WordCategory } from '@lingoup/contracts';
import { normalizeTerm } from '@lingoup/learning-engine';

/** Exact common terms only. Ambiguous or unknown entries remain Other for manual organisation. */
export const WORD_CATEGORY_TERMS: Partial<Record<WordCategory, readonly string[]>> = {
  clothes:
    'clothes|clothing|dress|dressed|get dressed|undress|shirt|t-shirt|tshirt|blouse|trousers|pants|jeans|shorts|skirt|jacket|coat|sweater|jumper|hoodie|suit|uniform|sock|socks|shoe|shoes|boot|boots|sneakers|trainers|sandals|slippers|hat|cap|scarf|gloves|belt|tie|underwear|pajamas|pyjamas|raincoat|swimsuit|outfit|sleeve|sleeves|wardrobe'.split(
      '|',
    ),
  food: 'food|drink|breakfast|lunch|dinner|supper|meal|snack|apple|apples|banana|bananas|orange|oranges|fruit|vegetable|vegetables|bread|butter|cheese|milk|yogurt|yoghurt|egg|eggs|meat|beef|pork|chicken|fish|rice|pasta|potato|potatoes|tomato|tomatoes|onion|onions|carrot|carrots|salad|soup|sandwich|pizza|cake|chocolate|sugar|salt|pepper|honey|jam|coffee|tea|water|juice|beer|wine|bottle|recipe|restaurant|cafe|menu|delicious|hungry|thirsty|grocery|groceries|baker|bakery'.split(
    '|',
  ),
  travel:
    'travel|travelling|traveling|trip|journey|holiday|vacation|tourist|tourism|sightseeing|destination|passport|visa|ticket|boarding pass|luggage|suitcase|backpack|airport|airplane|aeroplane|plane|flight|train|station|train station|bus|bus stop|taxi|tram|subway|underground|car|bicycle|bike|ferry|boat|ship|hotel|hostel|reservation|check in|check out|platform|departure|arrival|commute|commuter|traffic|roundabout|crossroads'.split(
      '|',
    ),
  work: 'work|job|career|office|colleague|colleagues|coworker|boss|manager|employee|employer|salary|wage|wages|meeting|deadline|interview|resume|cv|contract|business|company|profession|professional|teamwork|promotion|unemployed|employment|workplace|workload|overtime|work-life balance'.split(
    '|',
  ),
  home: 'home|house|apartment|flat|room|bedroom|bathroom|kitchen|living room|dining room|garden|balcony|stairs|staircase|door|window|floor|ceiling|wall|roof|furniture|table|chair|sofa|couch|bed|pillow|blanket|shelf|cupboard|drawer|mirror|curtain|curtains|fridge|refrigerator|oven|kettle|dishwasher|washing machine|vacuum cleaner|housework|laundry|tidy|rent|landlord|tenant|neighbour|neighbor'.split(
    '|',
  ),
  shopping:
    'shopping|shop|store|supermarket|market|mall|cashier|customer|checkout|receipt|refund|discount|sale|price|cost|expensive|cheap|affordable|bargain|purchase|buy|bought|sell|sold|payment|cash|credit card|debit card|wallet|purse|delivery|parcel|shopping basket|shopping cart'.split(
      '|',
    ),
  people:
    'family|friend|friends|friendship|mother|father|parent|parents|sister|brother|child|children|daughter|son|grandmother|grandfather|grandparent|cousin|aunt|uncle|wife|husband|marriage|wedding|relationship|happy|happiness|sad|sadness|angry|anger|excited|excitement|anxious|anxiety|worried|worry|lonely|loneliness|proud|pride|grateful|gratitude|kindness|confident|confidence|empathy|resilience'.split(
      '|',
    ),
  nature:
    'nature|weather|sun|sunshine|moon|star|stars|sky|cloud|clouds|rain|rainy|snow|snowy|wind|windy|storm|thunder|lightning|fog|forest|tree|trees|flower|flowers|plant|plants|leaf|leaves|grass|mountain|river|lake|sea|ocean|beach|island|desert|animal|animals|bird|birds|dog|cat|horse|wildlife|environment|climate|pollution|recycle|recycling|sustainable|sustainability'.split(
      '|',
    ),
  health:
    'health|healthy|illness|disease|sick|ill|hospital|clinic|doctor|nurse|patient|medicine|medication|pharmacy|prescription|headache|toothache|stomachache|fever|cough|sneeze|pain|injury|injured|wound|bandage|appointment|dentist|surgery|treatment|recover|recovery|vaccine|vaccination|allergy|allergic|exercise|fitness|gym'.split(
      '|',
    ),
  education:
    'education|school|university|college|classroom|student|teacher|professor|lesson|learn|learning|study|studying|homework|exam|examination|test|quiz|grade|degree|diploma|scholarship|textbook|notebook|book|library|lecture|knowledge|grammar|vocabulary|pronunciation|dictionary|essay|assignment|subject|curriculum'.split(
      '|',
    ),
  technology:
    'technology|computer|laptop|keyboard|screen|monitor|printer|smartphone|phone|tablet|internet|website|browser|password|software|hardware|application|app|email|download|upload|database|network|wi-fi|wifi|bluetooth|charger|battery|headphones|earphones|microphone|camera|programming|programmer|algorithm|encryption|cybersecurity|artificial intelligence'.split(
      '|',
    ),
  'daily-life':
    'wake up|woke up|get up|got up|go to bed|sleep|asleep|awake|brush|brush my teeth|brush your teeth|take a shower|have a shower|routine|daily routine|morning|afternoon|evening|night|weekend|weekday|today|tomorrow|yesterday|always|usually|sometimes|often|never|rarely|early|late|hurry|relax|relaxation|free time|leisure|hobby|hobbies'.split(
      '|',
    ),
};

const termCategories = new Map<string, WordCategory>();
for (const [category, terms] of Object.entries(WORD_CATEGORY_TERMS)) {
  for (const term of terms) termCategories.set(normalizeTerm(term), category as WordCategory);
}

export function inferWordCategory(term: string): WordCategory {
  return termCategories.get(normalizeTerm(term)) ?? 'other';
}
