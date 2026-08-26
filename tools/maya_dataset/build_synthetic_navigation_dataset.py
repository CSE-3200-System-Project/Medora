from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data" / "maya_navigation_sft_v1"
MAYA_RED_FLAGS = ROOT / "tests" / "benchmarks" / "datasets" / "symptom_navigation_cases.jsonl"
MAYA_BENIGN = ROOT / "experiments" / "maya" / "benign_controls.jsonl"

SOURCE_URLS = {
    "BD_999": "https://telecom-police.portal.gov.bd/pages/static-pages/695e3b0cc4774958d7b72321",
    "WHO_TRIAGE": "https://www.who.int/tools/triage",
    "WHO_BASIC_EMERGENCY": "https://www.who.int/publications/i/item/basic-emergency-care-approach-to-the-acutely-ill-and-injured",
    "WHO_MATERNAL": "https://www.who.int/campaigns/world-health-day/2025/key-messages",
    "WHO_SELF_HARM": "https://www.emro.who.int/mhps/suicide.html",
    "WHO_SEPSIS": "https://www.who.int/news-room/fact-sheets/detail/sepsis",
    "NHS_CHILD": "https://www.nhs.uk/baby/health/is-your-baby-or-toddler-seriously-ill/",
    "NHS_POISONING": "https://www.nhs.uk/conditions/poisoning/",
}


@dataclass(frozen=True)
class Family:
    key: str
    topic: str
    safety_class: str
    prompts: tuple[str, str, str, str]
    answers: tuple[str, str, str]
    source_keys: tuple[str, ...] = ("WHO_TRIAGE", "BD_999")


def f(
    key: str,
    topic: str,
    safety_class: str,
    bn_formal: str,
    bn_casual: str,
    banglish: str,
    english: str,
    answer_bn: str,
    answer_banglish: str,
    answer_en: str,
    *source_keys: str,
) -> Family:
    return Family(
        key=key,
        topic=topic,
        safety_class=safety_class,
        prompts=(bn_formal, bn_casual, banglish, english),
        answers=(answer_bn, answer_banglish, answer_en),
        source_keys=tuple(source_keys) or ("WHO_TRIAGE", "BD_999"),
    )


FAMILIES = [
    f(
        "allergy_mild", "allergy", "routine",
        "প্রতি সকালে হালকা হাঁচি ও নাক চুলকায়, কিন্তু শ্বাসকষ্ট বা মুখ ফুলে যাওয়া নেই। কোন ধরনের সেবা নেব?",
        "সকালে নাক চুলকায় আর কয়েকবার হাঁচি হয়, পরে ঠিক হয়ে যায়। শ্বাস নিতে সমস্যা নেই—কাকে দেখাব?",
        "Sokale halka hachi ar nak chulkay, pore thik hoye jay. Shashkosto ba mukh fola nei, kothay dekhabo?",
        "I get mild sneezing and an itchy nose most mornings, then it settles. I have no breathing trouble or facial swelling. Where should I seek care?",
        "নিয়মিত হলে একজন সাধারণ চিকিৎসকের রুটিন অ্যাপয়েন্টমেন্ট নিন এবং কখন বা কীসে বাড়ে তা লিখে রাখুন। শ্বাসকষ্ট, গলা বা মুখ ফুলে যাওয়া, মাথা ঘোরা বা দ্রুত অবনতি হলে জরুরি সহায়তা নিন এবং বাংলাদেশে ৯৯৯-এ কল করুন।",
        "Bar bar hole routine GP appointment nin ebong kokhon ba kishe bare note korun. Shashkosto, gola/mukh fola, matha ghora ba druto kharap hole emergency care nin ebong Bangladesh-e 999 call korun.",
        "Book a routine primary-care appointment if this keeps happening and note when or where it worsens. Seek emergency help and call 999 in Bangladesh if breathing becomes difficult, the face or throat swells, you feel faint, or symptoms worsen quickly.",
    ),
    f(
        "cold_cough_mild", "respiratory", "routine",
        "দুই দিন ধরে হালকা সর্দি ও কাশি আছে; স্বাভাবিকভাবে শ্বাস নিতে, খেতে ও কাজ করতে পারছি। এখন কী করব?",
        "দুই দিন ধরে একটু সর্দি-কাশি, কিন্তু শ্বাস ঠিক আছে আর দৈনন্দিন কাজ করতে পারছি। ডাক্তার লাগবে?",
        "Dui din dhore halka sordi-kashi, kintu shash thik ache ar kaj korte parchi. Doctor dekhabo?",
        "I have had a mild cold and cough for two days, but I can breathe, eat, and do normal activities. What level of care makes sense?",
        "বিশ্রাম নিন, পর্যাপ্ত তরল পান করুন এবং উপসর্গের পরিবর্তন লক্ষ্য করুন; না কমলে বা বারবার হলে সাধারণ চিকিৎসকের পরামর্শ নিন। শ্বাসকষ্ট, নীলচে ঠোঁট, বিভ্রান্তি, অজ্ঞান হওয়া বা দ্রুত অবনতি হলে জরুরি সহায়তা নিন।",
        "Rest nin, porjapto fluid pan korun, ar symptom bodlay kina dekhen; na komle GP-r poramorsho nin. Shashkosto, thot nil hoye jawa, confusion, oggan ba druto kharap hole emergency care nin.",
        "Rest, drink enough fluids, and monitor for change; contact primary care if it does not improve or keeps returning. Seek emergency care for breathing difficulty, blue lips, confusion, fainting, or rapid deterioration.",
    ),
    f(
        "headache_mild", "headache", "routine",
        "কয়েক দিন ধরে বিকেলে হালকা মাথাব্যথা হয়, বিশ্রামে কমে; হঠাৎ শুরু হয়নি এবং দুর্বলতা বা দৃষ্টি সমস্যা নেই। কাকে দেখাব?",
        "বিকেলে মাথা একটু ধরে, বিশ্রাম নিলে কমে যায়। হঠাৎ তীব্র হয়নি, হাত-পা দুর্বলও না—কীভাবে শুরু করব?",
        "Bikale matha halka dhore, rest nile kome. Hothat severe na, weakness ba vision problem-o nei. Kake dekhabo?",
        "I get a mild headache in the afternoon that improves with rest. It was not sudden, and I have no weakness or vision change. Who should I see?",
        "বারবার হলে সাধারণ চিকিৎসকের রুটিন অ্যাপয়েন্টমেন্ট নিন এবং সময়, ঘুম, পানি পান ও সম্ভাব্য ট্রিগার লিখে রাখুন। হঠাৎ জীবনের সবচেয়ে তীব্র মাথাব্যথা, একপাশ দুর্বল হওয়া, কথা জড়ানো, খিঁচুনি বা অজ্ঞান হলে জরুরি সহায়তা নিন।",
        "Bar bar hole routine GP appointment nin; somoy, ghum, pani ar trigger note korun. Hothat jiboner shobcheye severe headache, ek pashe weakness, kotha joriye jawa, seizure ba oggan hole emergency care nin.",
        "Arrange a routine primary-care visit if it recurs and track timing, sleep, fluids, and possible triggers. Seek emergency help for a sudden worst-ever headache, one-sided weakness, speech trouble, a seizure, or loss of consciousness.",
    ),
    f(
        "indigestion_after_meals", "digestive", "routine",
        "মসলাযুক্ত খাবারের পর মাঝে মাঝে বুকের নিচে জ্বালাপোড়া হয়, বিশ্রামে কমে; শ্বাসকষ্ট, ঘাম বা চাপধরা বুকব্যথা নেই। কোথায় যাব?",
        "ঝাল খেলে মাঝে মাঝে পেটের ওপর দিকে জ্বালা করে, একটু পরে কমে যায়। শ্বাসকষ্ট বা চাপধরা বুকব্যথা নেই—কাকে দেখাব?",
        "Jhal khelei majhe majhe peter upor dike jwala kore, pore kome. Shashkosto ba pressure-er moto chest pain nei. Kake dekhabo?",
        "I sometimes get upper-abdominal burning after spicy food and it settles later. I have no breathlessness, sweating, or pressure-like chest pain. Where should I start?",
        "উপসর্গ চলতে থাকলে সাধারণ চিকিৎসকের রুটিন পরামর্শ নিন এবং কোন খাবারে কখন বাড়ে তা লিখুন। চাপধরা বুকব্যথা, শ্বাসকষ্ট, অজ্ঞানভাব, রক্তবমি বা কালো পায়খানা হলে জরুরি মূল্যায়ন নিন।",
        "Symptom cholte thakle routine GP advice nin ar kon khabare kokhon bare note korun. Pressure-er moto chest pain, shashkosto, faint lagle, blood vomit ba black stool hole emergency assessment nin.",
        "If it continues, arrange a routine primary-care review and record which foods and times trigger it. Seek urgent emergency assessment for pressure-like chest pain, breathlessness, faintness, vomiting blood, or black stools.",
    ),
    f(
        "constipation", "digestive", "routine",
        "এক সপ্তাহ ধরে পায়খানা শক্ত হচ্ছে, তবে গ্যাস যাচ্ছে, খেতে পারছি এবং তীব্র পেটব্যথা বা বমি নেই। কী সেবা নেব?",
        "কয়েক দিন ধরে পায়খানা শক্ত, কিন্তু খেতে পারছি আর তীব্র ব্যথা বা বমি নেই। ডাক্তার দেখানো দরকার?",
        "Koyek din dhore stool hard, kintu khete parchi ar severe pain ba vomiting nei. Doctor dekhano dorkar?",
        "My stools have been hard for about a week, but I can eat and pass gas, with no severe pain or vomiting. What care should I seek?",
        "পানি, খাবার ও চলাফেরার অভ্যাস লিখে রেখে সাধারণ চিকিৎসকের রুটিন পরামর্শ নিন, বিশেষ করে সমস্যা চললে বা বারবার হলে। তীব্র বা বাড়তে থাকা পেটব্যথা, বারবার বমি, পেট খুব ফুলে যাওয়া, রক্তপাত বা গ্যাস বন্ধ হলে জরুরি মূল্যায়ন নিন।",
        "Pani, khabar ar activity-r obhyash note kore routine GP advice nin, especially problem cholte thakle. Severe ba barte thaka pain, repeated vomiting, pet beshi fola, bleeding ba gas bondho hole urgent assessment nin.",
        "Review fluids, food, and activity with primary care, especially if the problem continues or recurs. Seek urgent assessment for severe or worsening abdominal pain, repeated vomiting, marked swelling, bleeding, or inability to pass gas.",
    ),
    f(
        "diarrhoea_mild", "digestive", "same_day_if_persistent",
        "আজ তিনবার পাতলা পায়খানা হয়েছে, কিন্তু পানি খেতে পারছি; রক্ত, খুব জ্বর, মাথা ঘোরা বা প্রস্রাব কমে যাওয়া নেই। এখন কী করব?",
        "আজ কয়েকবার পাতলা পায়খানা হয়েছে, তবে পানি খেতে পারছি আর রক্ত বা মাথা ঘোরা নেই। কোথায় যোগাযোগ করব?",
        "Aj koyekbar loose motion, kintu pani khete parchi ar blood, beshi fever ba dizziness nei. Kothay contact korbo?",
        "I have had three loose stools today but can drink. There is no blood, high fever, dizziness, or reduced urination. What should I do next?",
        "তরল নিতে থাকুন এবং উপসর্গ পর্যবেক্ষণ করুন; না কমলে, বারবার হলে বা আপনি ঝুঁকিপূর্ণ হলে একই দিনে সাধারণ চিকিৎসকের পরামর্শ নিন। পানি রাখতে না পারা, রক্ত, অস্বাভাবিক ঘুমভাব, অজ্ঞানভাব বা প্রস্রাব খুব কমে গেলে জরুরি মূল্যায়ন নিন।",
        "Fluid nite thakun ar symptom monitor korun; na komle, bar bar hole ba high-risk hole same-day GP advice nin. Pani dhore rakhte na para, blood, unusual sleepiness, faint lagle ba urine onek kome gele urgent assessment nin.",
        "Keep taking fluids and monitor symptoms; seek same-day primary-care advice if it persists, recurs, or you are medically vulnerable. Get urgent assessment if you cannot keep fluids down, see blood, become unusually drowsy or faint, or pass very little urine.",
    ),
    f(
        "back_pain_desk", "musculoskeletal", "routine",
        "দীর্ঘ সময় ডেস্কে বসার পর কোমরে হালকা ব্যথা হয়, হাঁটতে পারি; আঘাত, জ্বর, অসাড়তা বা প্রস্রাব-পায়খানা নিয়ন্ত্রণের সমস্যা নেই। কাকে দেখাব?",
        "অনেকক্ষণ বসলে কোমর ব্যথা করে, কিন্তু হাঁটতে পারি আর পা অবশ হয় না। কোথা থেকে শুরু করব?",
        "Onekkhon bosle komor betha kore, kintu hatte pari ar pa numb hoy na. Kothay theke start korbo?",
        "My lower back aches after long desk sessions, but I can walk. There was no injury, fever, numbness, or bladder or bowel problem. Who should I see?",
        "ব্যথা থাকলে সাধারণ চিকিৎসক বা ফিজিওথেরাপি সেবার রুটিন মূল্যায়ন নিন এবং কোন ভঙ্গি বা কাজে বাড়ে তা লিখুন। নতুন দুর্বলতা, কুঁচকিতে অসাড়তা, প্রস্রাব-পায়খানা নিয়ন্ত্রণ হারানো, জ্বরসহ তীব্র ব্যথা বা বড় আঘাত হলে জরুরি মূল্যায়ন নিন।",
        "Pain thakle routine GP ba physiotherapy assessment nin ar kon posture-e bare note korun. Notun weakness, groin numbness, bladder/bowel control loss, fever-shoho severe pain ba major injury hole emergency assessment nin.",
        "Arrange routine primary-care or physiotherapy assessment if it continues and note activities or postures that worsen it. Seek emergency care for new weakness, groin numbness, loss of bladder or bowel control, severe pain with fever, or major injury.",
    ),
    f(
        "knee_pain_chronic", "musculoskeletal", "routine",
        "কয়েক মাস ধরে সিঁড়ি উঠলে হাঁটুতে ব্যথা হয়, কিন্তু হঠাৎ ফুলে যায়নি এবং হাঁটতে পারছি। কোন বিভাগে যাব?",
        "সিঁড়ি উঠলে অনেক দিন ধরে হাঁটু ব্যথা করে, কিন্তু হাঁটা যায় আর হঠাৎ ফুলেনি। কাকে দেখাব?",
        "Siri uthle onek din dhore knee pain hoy, kintu hatte pari ar hothat fule nai. Kake dekhabo?",
        "My knee has hurt on stairs for several months, but it is not suddenly swollen and I can still walk. What service should I use?",
        "একজন সাধারণ চিকিৎসক, অর্থোপেডিক বা ফিজিওথেরাপি সেবার রুটিন অ্যাপয়েন্টমেন্ট নিন; ব্যথার সময় ও কাজে সীমাবদ্ধতা লিখে রাখুন। বড় আঘাত, হাঁটতে না পারা, অস্বাভাবিক বিকৃতি, লাল-গরম দ্রুত ফোলা বা জ্বর হলে দ্রুত মূল্যায়ন নিন।",
        "Routine GP, orthopaedic ba physiotherapy appointment nin; pain-er somoy ar limitation note korun. Major injury, hatte na para, deformity, lal-gorom druto swelling ba fever hole urgent assessment nin.",
        "Book routine primary-care, orthopaedic, or physiotherapy assessment and track when pain limits activity. Seek urgent assessment after major injury, if you cannot bear weight, for deformity, or for rapid red-hot swelling with fever.",
    ),
    f(
        "ankle_sprain_mild", "injury", "same_day_if_persistent",
        "গতকাল পা মচকেছে; অল্প ফোলা, তবে ভর দিয়ে হাঁটতে পারি এবং পা বেঁকে যায়নি। কোথায় দেখাব?",
        "কাল গোড়ালি মচকে একটু ফুলেছে, কিন্তু হাঁটতে পারছি আর পা বাঁকা হয়নি। এখন কী করব?",
        "Kal ankle mochke ektu fuleche, kintu hatte parchi ar deformity nei. Ekhon ki korbo?",
        "I twisted my ankle yesterday. It is mildly swollen, but I can bear weight and there is no deformity. Where should I seek care?",
        "ব্যথা বা ফোলা না কমলে একই দিন বা পরবর্তী সুবিধাজনক সময়ে প্রাথমিক চিকিৎসা কেন্দ্রে মূল্যায়ন নিন এবং পায়ে অতিরিক্ত চাপ এড়িয়ে চলুন। পা বেঁকে যাওয়া, অসাড় বা ঠান্ডা হয়ে যাওয়া, তীব্র ফোলা, খোলা ক্ষত বা একেবারেই ভর দিতে না পারলে জরুরি মূল্যায়ন নিন।",
        "Pain ba swelling na komle same-day ba next available primary-care assessment nin ar extra pressure eriye cholun. Deformity, numb/cold foot, severe swelling, open wound ba weight dite na parle urgent assessment nin.",
        "Arrange primary-care assessment if pain or swelling is not settling, and avoid extra strain meanwhile. Seek urgent care for deformity, a numb or cold foot, severe swelling, an open wound, or inability to bear any weight.",
    ),
    f(
        "rash_mild", "dermatology", "routine",
        "হাতে ছোট চুলকানিযুক্ত দাগ তিন দিন ধরে আছে, ছড়াচ্ছে না; শ্বাসকষ্ট, মুখ ফুলে যাওয়া বা জ্বর নেই। কাকে দেখাব?",
        "হাতে ছোট একটা চুলকানির দাগ হয়েছে, বাড়ছে না আর শ্বাসকষ্ট বা মুখ ফোলা নেই। কোথায় দেখাব?",
        "Hate choto itchy rash, barche na ar shashkosto ba mukh fola nei. Kothay dekhabo?",
        "I have had a small itchy patch on my hand for three days. It is not spreading, and there is no fever, facial swelling, or breathing trouble. Who should I see?",
        "দাগের ছবি ও নতুন পণ্য বা সংস্পর্শের তথ্য রেখে সাধারণ চিকিৎসক বা চর্মরোগ বিশেষজ্ঞের রুটিন পরামর্শ নিন। শ্বাসকষ্ট, ঠোঁট-জিহ্বা-মুখ ফুলে যাওয়া, অজ্ঞানভাব, দ্রুত ছড়ানো বেগুনি দাগ বা খুব অসুস্থ লাগলে জরুরি সহায়তা নিন।",
        "Rash-er photo ar notun product/contact note kore routine GP ba dermatologist advice nin. Shashkosto, lip-jib-mukh fola, faint lagle, druto chhorano purple rash ba khub oshustho lagle emergency care nin.",
        "Keep a photo and note new products or exposures, then arrange routine primary-care or dermatology advice. Seek emergency help for breathing difficulty, lip, tongue, or facial swelling, faintness, a rapidly spreading purple rash, or severe illness.",
    ),
    f(
        "acne", "dermatology", "routine",
        "কয়েক মাস ধরে মুখে ব্রণ হচ্ছে; জ্বর, দ্রুত ছড়ানো লালভাব বা চোখের কাছে ফোলা নেই। চিকিৎসা নিয়ে কার সঙ্গে কথা বলব?",
        "অনেক দিন ধরে মুখে ব্রণ হচ্ছে, কিন্তু জ্বর বা হঠাৎ বড় ফোলা নেই। কোন ডাক্তার দেখাব?",
        "Onek din dhore acne hocche, kintu fever ba hothat boro swelling nei. Kon doctor dekhabo?",
        "I have had facial acne for several months, with no fever, rapidly spreading redness, or swelling near the eyes. Who should I talk to?",
        "সাধারণ চিকিৎসক বা চর্মরোগ বিশেষজ্ঞের রুটিন অ্যাপয়েন্টমেন্ট নিন এবং ব্যবহৃত ত্বকপণ্যের তালিকা রাখুন। দ্রুত ছড়ানো লাল-গরম ফোলা, চোখের চারপাশে ফোলা, জ্বর বা খুব অসুস্থ লাগলে দ্রুত চিকিৎসা নিন।",
        "Routine GP ba dermatologist appointment nin ar used skin products-er list rakhun. Druto chhorano lal-gorom swelling, chokher charpashe swelling, fever ba khub oshustho lagle urgent care nin.",
        "Book routine primary-care or dermatology review and bring a list of skin products you use. Seek prompt care for rapidly spreading hot redness, swelling around an eye, fever, or feeling very unwell.",
    ),
    f(
        "dandruff", "dermatology", "routine",
        "মাথার ত্বকে কয়েক সপ্তাহ ধরে খুশকি ও হালকা চুলকানি আছে, ক্ষত বা জ্বর নেই। কোথায় পরামর্শ নেব?",
        "কয়েক সপ্তাহ ধরে খুশকি আর একটু চুলকায়, কিন্তু ঘা বা জ্বর নেই। কাকে দেখাব?",
        "Koyek shoptaho dhore dandruff ar halka itch, kintu gha ba fever nei. Kake dekhabo?",
        "I have had scalp flaking and mild itching for a few weeks, but no sores or fever. Where should I get advice?",
        "সমস্যা চলতে থাকলে সাধারণ চিকিৎসক বা চর্মরোগ বিশেষজ্ঞের রুটিন পরামর্শ নিন এবং নতুন চুলের পণ্যের তথ্য দিন। ব্যথাযুক্ত দ্রুত ছড়ানো লালভাব, পুঁজ, জ্বর বা হঠাৎ অনেক চুল পড়লে দ্রুত মূল্যায়ন নিন।",
        "Problem cholte thakle routine GP ba dermatologist advice nin ar new hair products-er info din. Painful spreading redness, pus, fever ba hothat onek hair loss hole prompt assessment nin.",
        "If it persists, arrange routine primary-care or dermatology advice and mention any new hair products. Seek prompt assessment for painful spreading redness, pus, fever, or sudden marked hair loss.",
    ),
    f(
        "tooth_pain", "dental", "routine",
        "একটি দাঁতে কয়েক দিন ধরে ব্যথা, কিন্তু মুখ বা গলা ফুলে যায়নি, জ্বর নেই এবং গিলতে পারছি। কোথায় যাব?",
        "কয়েক দিন ধরে একটা দাঁত ব্যথা করছে, কিন্তু মুখ ফুলেনি আর গিলতে সমস্যা নেই। কাকে দেখাব?",
        "Koyek din dhore ekta tooth pain, kintu mukh fole nai ar gilte problem nei. Kake dekhabo?",
        "One tooth has hurt for a few days, but my face and throat are not swollen, I have no fever, and I can swallow. Where should I go?",
        "যত দ্রুত সম্ভব একটি ডেন্টাল অ্যাপয়েন্টমেন্ট নিন এবং ব্যথা কতদিন ও কীসে বাড়ে তা জানান। শ্বাস বা গিলতে কষ্ট, মুখ-গলা দ্রুত ফুলে যাওয়া, চোখের দিকে ফোলা, অজ্ঞানভাব বা খুব অসুস্থ লাগলে জরুরি সহায়তা নিন।",
        "Joto taratari possible dental appointment nin ar pain koto din, kishe bare bolun. Shash/gilte kosto, mukh-gola druto fola, chokher dike swelling, faint lagle ba khub oshustho hole emergency care nin.",
        "Arrange a dental appointment as soon as practical and report how long the pain has lasted and what worsens it. Seek emergency help for trouble breathing or swallowing, rapidly increasing face or throat swelling, swelling toward an eye, faintness, or severe illness.",
    ),
    f(
        "gum_bleeding", "dental", "routine",
        "দাঁত ব্রাশের সময় মাড়ি থেকে অল্প রক্ত আসে, অন্য কোথাও রক্তপাত বা দুর্বলতা নেই। কোন সেবা নেব?",
        "ব্রাশ করলে মাড়ি থেকে একটু রক্ত আসে, কিন্তু অন্য রক্তপাত নেই। ডেন্টিস্ট দেখাব?",
        "Brush korle gum theke ektu blood ashe, kintu onno bleeding nei. Dentist dekhabo?",
        "My gums bleed a little when I brush, but I have no other bleeding or weakness. What service should I use?",
        "একটি রুটিন ডেন্টাল পরীক্ষা বুক করুন এবং কতদিন ধরে হচ্ছে ও ব্যবহৃত মুখের যত্নপণ্যের তথ্য দিন। রক্তপাত বন্ধ না হওয়া, অনেক রক্ত, মুখ-গলা ফুলে যাওয়া, অজ্ঞানভাব বা শরীরের অন্য জায়গায় অস্বাভাবিক রক্তপাত হলে দ্রুত চিকিৎসা নিন।",
        "Routine dental check-up book korun ar koto din dhore hocche bolun. Bleeding bondho na hole, onek blood, mukh-gola fola, faint lagle ba body-r onno jaygay unusual bleeding hole urgent care nin.",
        "Book a routine dental examination and mention how long it has happened and what oral-care products you use. Seek prompt care if bleeding will not stop, is heavy, comes with face or throat swelling or faintness, or appears unusually elsewhere.",
    ),
    f(
        "ear_discomfort", "ent", "routine",
        "সর্দির পর এক কানে চাপ ও কম শোনার অনুভূতি হচ্ছে, কিন্তু তীব্র ব্যথা, মাথা ঘোরা, আঘাত বা জ্বর নেই। কাকে দেখাব?",
        "সর্দির পর এক কানে বন্ধ বন্ধ লাগে আর একটু কম শুনি, কিন্তু তীব্র ব্যথা বা জ্বর নেই। কোথায় যাব?",
        "Sordir por ek kan bondho bondho lage ar kom shuni, kintu severe pain ba fever nei. Kothay jabo?",
        "After a cold, one ear feels blocked and hearing seems reduced, but there is no severe pain, dizziness, injury, or fever. Who should I see?",
        "সমস্যা না কমলে সাধারণ চিকিৎসক বা কান-নাক-গলা বিশেষজ্ঞের রুটিন মূল্যায়ন নিন; কানে কিছু ঢোকাবেন না। হঠাৎ সম্পূর্ণ শ্রবণশক্তি কমে যাওয়া, মুখ দুর্বল হওয়া, তীব্র মাথা ঘোরা, কানে আঘাত বা খুব অসুস্থ লাগলে দ্রুত মূল্যায়ন নিন।",
        "Na komle routine GP ba ENT assessment nin; kane kichu dhokaben na. Hothat hearing onek kome jawa, face weakness, severe dizziness, ear injury ba khub oshustho lagle urgent assessment nin.",
        "Arrange routine primary-care or ENT assessment if it does not settle, and do not insert anything into the ear. Seek urgent assessment for sudden major hearing loss, facial weakness, severe dizziness, ear injury, or severe illness.",
    ),
    f(
        "eye_strain", "eye", "routine",
        "কম্পিউটারে দীর্ঘ সময় কাজের পর চোখ ক্লান্ত ও শুকনো লাগে, বিশ্রামে কমে; হঠাৎ দৃষ্টি কমা, তীব্র ব্যথা বা আঘাত নেই। কাকে দেখাব?",
        "স্ক্রিনে অনেকক্ষণ থাকলে চোখ শুকায় আর ক্লান্ত লাগে, বিরতিতে কমে। হঠাৎ কম দেখা বা তীব্র ব্যথা নেই—কোথায় যাব?",
        "Screen-e onekkhon thakle chokh dry ar tired lage, break nile kome. Hothat vision loss ba severe pain nei. Kake dekhabo?",
        "My eyes feel tired and dry after long computer use and improve with breaks. There is no sudden vision loss, severe pain, or injury. Who should I see?",
        "না কমলে অপটোমেট্রি, চক্ষু বা সাধারণ চিকিৎসা সেবার রুটিন মূল্যায়ন নিন এবং স্ক্রিন ব্যবহারের সময় লিখে রাখুন। হঠাৎ দৃষ্টি কমা, তীব্র চোখব্যথা, রাসায়নিক লাগা, বড় আঘাত বা আলো ঝলকসহ নতুন পর্দার মতো ছায়া হলে জরুরি মূল্যায়ন নিন।",
        "Na komle routine optometry, eye ba GP assessment nin ar screen time note korun. Hothat vision loss, severe eye pain, chemical exposure, major injury ba flash-er sathe curtain-like shadow hole emergency assessment nin.",
        "Arrange routine optometry, eye-care, or primary-care review if it persists and record your screen time. Seek emergency assessment for sudden vision loss, severe eye pain, chemical exposure, major injury, or new flashes with a curtain-like shadow.",
    ),
    f(
        "diabetes_followup", "chronic_care", "routine",
        "ডায়াবেটিসের নিয়মিত ফলো-আপ আগামী মাসে করার কথা; এখন নতুন কোনো উপসর্গ নেই। কীভাবে অ্যাপয়েন্টমেন্ট নেব?",
        "আগামী মাসে ডায়াবেটিসের রুটিন চেকআপ দরকার, এখন নতুন সমস্যা নেই। কোন সেবা বুক করব?",
        "Agami mashe diabetes routine follow-up dorkar, ekhon notun symptom nei. Kon service book korbo?",
        "My routine diabetes follow-up is due next month and I have no new symptoms. What appointment should I book?",
        "আপনার নিয়মিত চিকিৎসক বা ডায়াবেটিস সেবার রুটিন অ্যাপয়েন্টমেন্ট বুক করুন এবং বর্তমান ওষুধের তালিকা ও আগের রিপোর্ট সঙ্গে রাখুন। বিভ্রান্তি, অজ্ঞান হওয়া, শ্বাসকষ্ট, বারবার বমি বা দ্রুত অবনতি হলে জরুরি মূল্যায়ন নিন।",
        "Regular doctor ba diabetes service-er routine appointment book korun; current medicine list ar previous report niye jan. Confusion, oggan, shashkosto, repeated vomiting ba druto kharap hole emergency assessment nin.",
        "Book a routine visit with your usual clinician or diabetes service and bring your current medication list and previous reports. Seek emergency assessment for confusion, loss of consciousness, breathing difficulty, repeated vomiting, or rapid deterioration.",
    ),
    f(
        "blood_pressure_followup", "chronic_care", "routine",
        "রক্তচাপের নিয়মিত ফলো-আপ বাকি আছে, তবে এখন বুকব্যথা, শ্বাসকষ্ট, দুর্বলতা বা দৃষ্টি সমস্যা নেই। কোথায় যাব?",
        "ব্লাড প্রেসারের রুটিন চেকআপ করতে চাই, এখন কোনো নতুন সমস্যা নেই। কাকে দেখাব?",
        "Blood pressure routine check-up korte chai, ekhon notun kono problem nei. Kake dekhabo?",
        "I am due for a routine blood-pressure follow-up and currently have no chest pain, breathlessness, weakness, or vision problem. Where should I go?",
        "আপনার নিয়মিত চিকিৎসক বা প্রাথমিক সেবায় রুটিন ফলো-আপ বুক করুন এবং ওষুধের তালিকা ও সাম্প্রতিক মাপ থাকলে সঙ্গে নিন। বুকব্যথা, শ্বাসকষ্ট, অজ্ঞানভাব, একপাশ দুর্বল হওয়া, কথা জড়ানো বা নতুন দৃষ্টি সমস্যা হলে জরুরি সহায়তা নিন।",
        "Regular doctor ba primary care-e routine follow-up book korun; medicine list ar recent readings niye jan. Chest pain, shashkosto, faint lagle, ek pashe weakness, speech problem ba new vision change hole emergency care nin.",
        "Book routine follow-up with your usual clinician or primary care and bring your medication list and recent readings if available. Seek emergency help for chest pain, breathlessness, faintness, one-sided weakness, speech trouble, or a new vision problem.",
    ),
    f(
        "medicine_refill", "medication_admin", "routine",
        "দীর্ঘদিনের ওষুধ এক সপ্তাহ পরে শেষ হবে; নতুন উপসর্গ বা পার্শ্বপ্রতিক্রিয়া নেই। নিরাপদভাবে রিফিলের জন্য কার সঙ্গে যোগাযোগ করব?",
        "রেগুলার ওষুধ আর এক সপ্তাহ আছে, নতুন সমস্যা নেই। রিফিলের জন্য কোথায় কথা বলব?",
        "Regular medicine ar ek shoptaho ache, notun problem nei. Refill-er jonno kothay kotha bolbo?",
        "My long-term medication will run out in one week and I have no new symptoms or side effects. Who should I contact for a safe refill?",
        "ওষুধ শেষ হওয়ার আগেই যিনি প্রেসক্রাইব করেছেন সেই ক্লিনিক বা আপনার ফার্মাসিস্টের সঙ্গে রিফিল প্রক্রিয়া নিয়ে যোগাযোগ করুন; নিজে থেকে ডোজ বদলাবেন বা বন্ধ করবেন না। গুরুতর অ্যালার্জি, শ্বাসকষ্ট, অজ্ঞান হওয়া বা দ্রুত অবনতি হলে জরুরি সহায়তা নিন।",
        "Medicine shesh howar age prescriber clinic ba pharmacist-er sathe refill process niye contact korun; nij theke dose change ba stop korben na. Severe allergy, shashkosto, oggan ba druto kharap hole emergency care nin.",
        "Contact your regular clinic or pharmacist about the refill before it runs out; do not change the dose or stop it on your own. Seek emergency help for a severe allergic reaction, breathing difficulty, loss of consciousness, or rapid deterioration.",
    ),
    f(
        "sleep_difficulty", "sleep", "routine",
        "তিন সপ্তাহ ধরে ঘুম আসতে দেরি হয়, কিন্তু আমি নিরাপদ বোধ করছি এবং নিজের ক্ষতি করার চিন্তা নেই। কার সঙ্গে কথা বলব?",
        "কয়েক সপ্তাহ ধরে ঘুম ঠিক হচ্ছে না, তবে আমি নিরাপদ আছি আর নিজেকে আঘাতের চিন্তা নেই। কোথায় সাহায্য পাব?",
        "Koyek shoptaho dhore ghum thik hocche na, kintu ami safe ar self-harm thought nei. Kothay help pabo?",
        "For three weeks I have struggled to fall asleep, but I feel safe and have no thoughts of harming myself. Who should I speak with?",
        "সাধারণ চিকিৎসক বা মানসিক স্বাস্থ্য পেশাজীবীর রুটিন অ্যাপয়েন্টমেন্ট নিন এবং ঘুমের সময়, ক্যাফেইন ও দৈনন্দিন প্রভাব লিখুন। যদি নিজেকে ক্ষতি করার চিন্তা আসে, নিরাপদ থাকতে না পারেন, অস্বাভাবিক বিভ্রান্তি হয় বা তৎক্ষণাৎ বিপদ মনে হয়, একা থাকবেন না এবং জরুরি সহায়তা নিন।",
        "Routine GP ba mental-health professional appointment nin; sleep timing, caffeine ar daily impact note korun. Self-harm thought ashle, safe thakte na parle, unusual confusion hole ba immediate danger mone hole eka thakben na ebong emergency help nin.",
        "Arrange a routine appointment with primary care or a mental-health professional and track sleep timing, caffeine, and daily impact. If thoughts of self-harm appear, you cannot stay safe, become unusually confused, or face immediate danger, do not stay alone and seek emergency help.",
        "WHO_SELF_HARM", "BD_999",
    ),
    f(
        "anxiety_noncrisis", "mental_health", "routine",
        "কাজের চাপ নিয়ে কয়েক সপ্তাহ ধরে উদ্বিগ্ন লাগছে; আমি নিরাপদ, নিজের ক্ষতির পরিকল্পনা বা ইচ্ছা নেই। কাউন্সেলিং কীভাবে পাব?",
        "কাজের চাপ নিয়ে খুব চিন্তা হয়, কিন্তু আমি নিরাপদ আর নিজেকে আঘাতের ইচ্ছা নেই। কাউন্সেলিং কোথায় পাব?",
        "Kajer pressure niye anxiety hocche, kintu ami safe ar self-harm plan/ichchha nei. Counselling kothay pabo?",
        "I have felt anxious about work for several weeks, but I am safe and have no wish or plan to harm myself. How can I find counselling?",
        "একজন মানসিক স্বাস্থ্য পেশাজীবী, কাউন্সেলর বা সাধারণ চিকিৎসকের রুটিন অ্যাপয়েন্টমেন্ট নিন; চাইলে বিশ্বস্ত কাউকে সঙ্গে নিতে পারেন। নিজেকে ক্ষতি করার চিন্তা বা পরিকল্পনা এলে, নিরাপদ থাকতে না পারলে বা তৎক্ষণাৎ বিপদ মনে হলে একা থাকবেন না এবং জরুরি সহায়তা নিন।",
        "Mental-health professional, counsellor ba GP-r routine appointment nin; chaile trusted kauke sathe nite paren. Self-harm thought/plan ashle, safe thakte na parle ba immediate danger mone hole eka thakben na ebong emergency help nin.",
        "Book a routine appointment with a mental-health professional, counsellor, or primary-care clinician; you may bring someone you trust if you choose. If self-harm thoughts or a plan appear, you cannot stay safe, or danger feels immediate, do not stay alone and seek emergency help.",
        "WHO_SELF_HARM", "BD_999",
    ),
    f(
        "period_irregular", "reproductive_health", "routine",
        "গত তিন মাসে মাসিক অনিয়মিত হয়েছে; গর্ভধারণের সম্ভাবনা, তীব্র ব্যথা, মাথা ঘোরা বা বেশি রক্তপাত নেই। কাকে দেখাব?",
        "কয়েক মাস ধরে পিরিয়ড অনিয়মিত, কিন্তু খুব ব্যথা বা বেশি ব্লিডিং নেই আর প্রেগন্যান্সির সম্ভাবনাও নেই। কোথায় যাব?",
        "Koyek mash dhore period irregular, kintu severe pain, heavy bleeding ba pregnancy chance nei. Kake dekhabo?",
        "My periods have been irregular for three months, but there is no chance of pregnancy, severe pain, dizziness, or heavy bleeding. Who should I see?",
        "সাধারণ চিকিৎসক বা স্ত্রীরোগ সেবার রুটিন অ্যাপয়েন্টমেন্ট নিন এবং তারিখ, প্রবাহ ও অন্য পরিবর্তন লিখুন। গর্ভধারণের সম্ভাবনাসহ ব্যথা বা রক্তপাত, খুব বেশি রক্তপাত, অজ্ঞানভাব বা তীব্র পেটব্যথা হলে জরুরি মূল্যায়ন নিন।",
        "Routine GP ba gynaecology appointment nin; dates, flow ar other changes note korun. Pregnancy chance-er sathe pain/bleeding, very heavy bleeding, faint lagle ba severe abdominal pain hole urgent assessment nin.",
        "Arrange routine primary-care or gynaecology review and track dates, flow, and other changes. Seek urgent assessment for pain or bleeding with possible pregnancy, very heavy bleeding, faintness, or severe abdominal pain.",
        "WHO_MATERNAL", "BD_999",
    ),
    f(
        "urinary_burning", "urinary", "same_day_if_persistent",
        "আজ থেকে প্রস্রাবে হালকা জ্বালা, তবে জ্বর, পিঠের পাশের ব্যথা, বমি, গর্ভাবস্থা বা প্রস্রাব বন্ধ নেই। কোথায় যোগাযোগ করব?",
        "আজ প্রস্রাব করলে একটু জ্বালা করছে, কিন্তু জ্বর বা পিঠের পাশে ব্যথা নেই। কাকে দেখাব?",
        "Aj urine korle halka burning, kintu fever, side/back pain ba vomiting nei. Kake dekhabo?",
        "I have mild burning when urinating since today, but no fever, side or back pain, vomiting, pregnancy, or inability to urinate. Who should I contact?",
        "একই দিন বা পরবর্তী সুবিধাজনক সময়ে সাধারণ চিকিৎসকের পরামর্শ নিন, বিশেষ করে উপসর্গ থাকলে বা বাড়লে; নিজে থেকে অ্যান্টিবায়োটিক শুরু করবেন না। জ্বরসহ কাঁপুনি, পিঠের পাশে তীব্র ব্যথা, বারবার বমি, বিভ্রান্তি, গর্ভাবস্থা বা প্রস্রাব বন্ধ হলে দ্রুত মূল্যায়ন নিন।",
        "Same-day ba next available GP advice nin, especially symptom thakle/barle; nij theke antibiotic start korben na. Fever-shoho shivering, severe side/back pain, repeated vomiting, confusion, pregnancy ba urine bondho hole urgent assessment nin.",
        "Seek same-day or next-available primary-care advice if it persists or worsens; do not start antibiotics on your own. Get prompt assessment for fever with shaking, severe side or back pain, repeated vomiting, confusion, pregnancy, or inability to urinate.",
    ),
    f(
        "child_cough_active", "paediatrics", "routine",
        "আমার ছয় বছরের শিশুর এক সপ্তাহ ধরে হালকা কাশি, তবে সে খেলছে, পানি খাচ্ছে এবং স্বাভাবিকভাবে শ্বাস নিচ্ছে। কাকে দেখাব?",
        "ছয় বছরের বাচ্চার এক সপ্তাহ ধরে কাশি, কিন্তু খেলছে, পানি খাচ্ছে আর শ্বাস ঠিক আছে। কোথায় দেখাব?",
        "6 bochorer bacchar ek shoptaho dhore cough, kintu khelche, pani khacche ar shash normal. Kake dekhabo?",
        "My six-year-old has had a mild cough for a week but is playing, drinking, and breathing normally. Who should assess this?",
        "কাশি চলতে থাকায় শিশু বিশেষজ্ঞ বা সাধারণ চিকিৎসকের রুটিন অ্যাপয়েন্টমেন্ট নিন এবং সময়, জ্বর ও খাওয়ার পরিবর্তন লিখুন। শ্বাস নিতে পাঁজরের নিচে টান পড়া, নীল বা ধূসর ঠোঁট, জাগানো কঠিন, পানি না খাওয়া, প্রস্রাব কমা বা দ্রুত অবনতি হলে জরুরি সহায়তা নিন।",
        "Cough cholte thakay paediatrician ba GP-r routine appointment nin; timing, fever ar feeding change note korun. Shash nite rib-er niche tan, blue/grey lips, jagano kothin, pani na khawa, urine koma ba druto kharap hole emergency care nin.",
        "Because it has persisted, book routine paediatric or primary-care review and note timing, fever, and feeding changes. Seek emergency help for pulling in under the ribs when breathing, blue or grey lips, difficulty waking, inability to drink, reduced urination, or rapid deterioration.",
        "NHS_CHILD", "BD_999",
    ),
    f(
        "vaccination_record", "preventive_care", "routine",
        "শিশুর টিকার কার্ডে পরবর্তী টিকার তারিখ বুঝতে পারছি না; শিশু এখন ভালো আছে। কোথায় যাচাই করব?",
        "বাচ্চার ভ্যাকসিন কার্ডে পরের তারিখটা বুঝছি না, বাচ্চা এখন সুস্থ। কার কাছে জিজ্ঞেস করব?",
        "Bacchar vaccine card-e next date bujhte parchi na, baccha ekhon bhalo. Kothay verify korbo?",
        "I cannot tell the next vaccination date from my child's card, and the child is currently well. Where should I verify it?",
        "টিকার কার্ড নিয়ে স্থানীয় টিকাদান কেন্দ্র, শিশু সেবা বা নিয়মিত চিকিৎসকের সঙ্গে রুটিনভাবে তারিখ যাচাই করুন; অনলাইনের অনুমান দিয়ে সূচি বদলাবেন না। শিশু শ্বাস বন্ধ করলে, জাগানো না গেলে, খিঁচুনি হলে বা গুরুতর অ্যালার্জির লক্ষণ হলে জরুরি সহায়তা নিন।",
        "Vaccine card niye local vaccination centre, paediatric service ba regular doctor-er sathe date verify korun; online guess diye schedule change korben na. Baccha shash bondho korle, jagano na gele, seizure ba severe allergy hole emergency care nin.",
        "Take the card to the local vaccination service, paediatric clinic, or usual clinician to verify the schedule; do not change it based on an online guess. Seek emergency help if the child stops breathing, cannot be woken, has a seizure, or develops a severe allergic reaction.",
        "NHS_CHILD", "BD_999",
    ),
    f(
        "mild_fever_adult", "general", "same_day_if_persistent",
        "আজ হালকা জ্বর হয়েছে, কিন্তু সচেতন আছি, পানি খেতে পারছি এবং শ্বাসকষ্ট, ঘাড় শক্ত বা নতুন র‍্যাশ নেই। কীভাবে সেবা নেব?",
        "আজ একটু জ্বর, তবে পানি খেতে পারছি আর শ্বাসকষ্ট বা ঘাড় শক্ত নেই। কাকে ফোন করব?",
        "Aj halka fever, kintu pani khete parchi ar shashkosto, stiff neck ba new rash nei. Kake contact korbo?",
        "I developed a mild fever today but am alert, drinking, and have no breathing difficulty, stiff neck, or new rash. What care should I seek?",
        "বিশ্রাম, তরল ও তাপমাত্রা পর্যবেক্ষণ করুন; জ্বর চললে, বাড়লে বা আপনার রোগপ্রতিরোধ ক্ষমতা কম হলে একই দিনে সাধারণ চিকিৎসকের পরামর্শ নিন। বিভ্রান্তি, শ্বাসকষ্ট, অজ্ঞানভাব, খিঁচুনি, ঘাড় শক্ত, দ্রুত ছড়ানো র‍্যাশ বা খুব অসুস্থ লাগলে জরুরি মূল্যায়ন নিন।",
        "Rest, fluid ar temperature monitor korun; fever thakle/barle ba immunity kom hole same-day GP advice nin. Confusion, shashkosto, faint, seizure, stiff neck, rapidly spreading rash ba khub oshustho lagle emergency assessment nin.",
        "Rest, take fluids, and monitor temperature; seek same-day primary-care advice if fever persists, worsens, or you have reduced immunity. Get emergency assessment for confusion, breathing difficulty, fainting, seizure, stiff neck, a rapidly spreading rash, or severe illness.",
        "WHO_SEPSIS", "BD_999",
    ),
    f(
        "nausea_mild", "digestive", "routine",
        "আজ হালকা বমিভাব আছে, তবে বমি হয়নি, পানি ও খাবার রাখতে পারছি এবং তীব্র ব্যথা বা গর্ভাবস্থা নেই। কী করব?",
        "আজ একটু বমি বমি লাগছে, কিন্তু কিছু খেলেই থাকছে আর তীব্র ব্যথা নেই। কোথায় যোগাযোগ করব?",
        "Aj halka nausea, kintu vomit hoy nai, pani-khabar thakche ar severe pain nei. Kothay contact korbo?",
        "I feel mildly nauseated today but have not vomited, can keep food and fluids down, and have no severe pain or pregnancy. What should I do?",
        "তরল নিতে থাকুন এবং উপসর্গ পর্যবেক্ষণ করুন; না কমলে বা বারবার হলে সাধারণ চিকিৎসকের পরামর্শ নিন। বারবার বমি, পানি রাখতে না পারা, তীব্র পেটব্যথা, রক্ত, অজ্ঞানভাব, বিভ্রান্তি বা প্রস্রাব খুব কমে গেলে জরুরি মূল্যায়ন নিন।",
        "Fluid nite thakun ar symptom monitor korun; na komle ba bar bar hole GP advice nin. Repeated vomiting, fluid dhore rakhte na para, severe pain, blood, faint, confusion ba urine onek kome gele urgent assessment nin.",
        "Keep taking fluids and monitor symptoms; contact primary care if it does not settle or keeps returning. Seek urgent assessment for repeated vomiting, inability to keep fluids down, severe abdominal pain, blood, faintness, confusion, or markedly reduced urination.",
    ),
    f(
        "exertional_breathlessness_stable", "cardiorespiratory", "routine_prompt_review",
        "কয়েক মাস ধরে দ্রুত সিঁড়ি উঠলে অল্প হাঁপাই, থামলে দ্রুত ঠিক হয়; বিশ্রামে শ্বাসকষ্ট, বুকব্যথা, অজ্ঞানভাব বা সাম্প্রতিক অবনতি নেই। কাকে দেখাব?",
        "দ্রুত সিঁড়ি উঠলে একটু হাঁপাই, থামলে ঠিক হয়; বিশ্রামে সমস্যা বা বুকব্যথা নেই। কোথায় চেক করাব?",
        "Fast siri uthle ektu hapai, thamle thik hoy; rest-e problem ba chest pain nei. Kothay check korabo?",
        "For several months I have become mildly breathless when climbing stairs quickly and recover after stopping. There is no breathlessness at rest, chest pain, faintness, or recent worsening. Who should assess it?",
        "সাধারণ চিকিৎসকের রুটিন মূল্যায়ন নিন এবং কখন শুরু হয়, কতক্ষণ থাকে ও পরিবর্তন হচ্ছে কি না লিখুন। বিশ্রামেও শ্বাসকষ্ট, বুকব্যথা, নীলচে ঠোঁট, অজ্ঞানভাব, বিভ্রান্তি বা হঠাৎ অবনতি হলে জরুরি সহায়তা নিন।",
        "Routine GP assessment nin ar kokhon start hoy, koto khon thake, change hocche kina note korun. Rest-eo shashkosto, chest pain, blue lips, faint, confusion ba hothat kharap hole emergency care nin.",
        "Arrange routine primary-care assessment and record when it starts, how long it lasts, and whether it is changing. Seek emergency help for breathlessness at rest, chest pain, blue lips, faintness, confusion, or sudden worsening.",
    ),
    f(
        "hair_loss_gradual", "dermatology", "routine",
        "কয়েক মাস ধরে ধীরে ধীরে চুল পাতলা হচ্ছে, কিন্তু মাথার ত্বকে ক্ষত, জ্বর বা হঠাৎ গোছা গোছা চুল পড়া নেই। কাকে দেখাব?",
        "অনেক দিন ধরে চুল একটু পাতলা হচ্ছে, কিন্তু ঘা বা হঠাৎ অনেক চুল পড়া নেই। কোন ডাক্তার দেখাব?",
        "Onek din dhore hair thin hocche, kintu scalp sore ba hothat patch-e hair loss nei. Kake dekhabo?",
        "My hair has gradually thinned over several months, with no scalp sores, fever, or sudden clumps falling out. Who should I see?",
        "সাধারণ চিকিৎসক বা চর্মরোগ বিশেষজ্ঞের রুটিন অ্যাপয়েন্টমেন্ট নিন এবং সময়, ব্যবহৃত পণ্য ও অন্য স্বাস্থ্য পরিবর্তন লিখুন। হঠাৎ অনেক চুল পড়া, ব্যথাযুক্ত বা পুঁজযুক্ত মাথার ত্বক, দ্রুত ছড়ানো লালভাব বা জ্বর হলে দ্রুত মূল্যায়ন নিন।",
        "Routine GP ba dermatologist appointment nin; timing, used products ar other health changes note korun. Hothat onek hair loss, painful/pus scalp, spreading redness ba fever hole prompt assessment nin.",
        "Book routine primary-care or dermatology review and note timing, products used, and other health changes. Seek prompt assessment for sudden marked hair loss, a painful or pus-filled scalp, spreading redness, or fever.",
    ),
    f(
        "antenatal_routine", "maternal_health", "routine",
        "আমি ১৬ সপ্তাহের গর্ভবতী এবং নিয়মিত চেকআপ বুক করতে চাই; রক্তপাত, তীব্র ব্যথা, মাথাব্যথা, দৃষ্টি সমস্যা বা শ্বাসকষ্ট নেই। কোথায় যাব?",
        "প্রেগন্যান্সির ১৬ সপ্তাহ চলছে, রুটিন চেকআপ দরকার। রক্তপাত, তীব্র ব্যথা বা অন্য বিপদের লক্ষণ নেই—কাকে দেখাব?",
        "Pregnancy 16 weeks, routine check-up dorkar. Bleeding, severe pain, headache, vision problem ba shashkosto nei. Kake dekhabo?",
        "I am 16 weeks pregnant and want to book routine antenatal care. I have no bleeding, severe pain, headache, vision problem, or breathing difficulty. Where should I go?",
        "প্রসূতি বা মাতৃস্বাস্থ্য সেবায় রুটিন অ্যান্টেনাটাল অ্যাপয়েন্টমেন্ট বুক করুন এবং আগের রিপোর্ট ও ওষুধের তালিকা নিন। রক্তপাত, তীব্র পেটব্যথা, খিঁচুনি, তীব্র মাথাব্যথা বা ঝাপসা দেখা, শ্বাসকষ্ট, পানি ভাঙা বা দ্রুত অবনতি হলে অবিলম্বে হাসপাতালে যান।",
        "Maternity/antenatal service-e routine appointment book korun; previous reports ar medicine list niye jan. Bleeding, severe abdominal pain, seizure, severe headache/blurred vision, shashkosto, pani bhanga ba druto kharap hole immediately hospital-e jan.",
        "Book routine antenatal care with a maternity service and bring previous reports and your medication list. Go to a hospital immediately for bleeding, severe abdominal pain, seizure, severe headache or blurred vision, breathing difficulty, fluid leakage, or rapid deterioration.",
        "WHO_MATERNAL", "BD_999",
    ),
]


VARIANTS = (
    ("bn_formal", "bn", 0),
    ("bn_conversational", "bn", 0),
    ("banglish", "banglish", 1),
    ("english", "en", 2),
)


def normalized(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).casefold()
    return re.sub(r"[^\w\u0980-\u09ff]+", " ", text).strip()


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_rows() -> list[dict]:
    assert len(FAMILIES) == 30
    assert len({family.key for family in FAMILIES}) == len(FAMILIES)
    rows = []
    for family_index, family in enumerate(FAMILIES):
        split = "train" if family_index < 25 else "validation"
        for variant_index, (variant, language, answer_index) in enumerate(VARIANTS):
            row_id = f"MAYA-SFT-{family_index + 1:03d}-{variant_index + 1}"
            rows.append(
                {
                    "id": row_id,
                    "messages": [
                        {"role": "user", "content": family.prompts[variant_index]},
                        {"role": "assistant", "content": family.answers[answer_index]},
                    ],
                    "language": language,
                    "split": split,
                    "review_status": "pending_clinical_review",
                    "reviewer_id": "",
                    "provenance": "medora_synthetic_navigation_v1",
                    "license": "Medora-internal-research-only",
                    "phi_free": True,
                    "synthetic": True,
                    "scenario_family": family.key,
                    "variant": variant,
                    "topic": family.topic,
                    "safety_class": family.safety_class,
                    "risk_scope": "non_urgent_navigation_only",
                    "evaluation_overlap": False,
                    "source_urls": [SOURCE_URLS[key] for key in family.source_keys],
                }
            )
    return rows


def validate(rows: list[dict]) -> dict:
    assert len(rows) == 120
    assert len({row["id"] for row in rows}) == 120
    assert sum(row["split"] == "train" for row in rows) == 100
    assert sum(row["split"] == "validation" for row in rows) == 20
    assert all(row["phi_free"] is True for row in rows)
    assert all(row["review_status"] == "pending_clinical_review" for row in rows)
    assert all(row["reviewer_id"] == "" for row in rows)
    assert all(row["risk_scope"] == "non_urgent_navigation_only" for row in rows)

    family_splits: dict[str, set[str]] = {}
    for row in rows:
        family_splits.setdefault(row["scenario_family"], set()).add(row["split"])
    assert all(len(splits) == 1 for splits in family_splits.values())

    prompts = [normalized(row["messages"][0]["content"]) for row in rows]
    assert len(set(prompts)) == len(prompts)
    maya_rows = read_jsonl(MAYA_RED_FLAGS) + read_jsonl(MAYA_BENIGN)
    maya_texts = [normalized(row["text"]) for row in maya_rows]
    for prompt in prompts:
        prompt_tokens = set(prompt.split())
        for maya_text in maya_texts:
            assert prompt != maya_text
            maya_tokens = set(maya_text.split())
            union = prompt_tokens | maya_tokens
            assert not union or len(prompt_tokens & maya_tokens) / len(union) < 0.80

    forbidden = re.compile(
        r"\b(?:diagnosed?|prescrib(?:e|ed|ing)|\d+(?:\.\d+)?\s*(?:mg|ml)|take\s+\d+)\b",
        re.IGNORECASE,
    )
    assert all(not forbidden.search(row["messages"][1]["content"]) for row in rows)

    return {
        "rows": len(rows),
        "splits": {name: sum(row["split"] == name for row in rows) for name in ("train", "validation")},
        "languages": {
            language: sum(row["language"] == language for row in rows)
            for language in ("bn", "banglish", "en")
        },
        "scenario_families": len(family_splits),
        "maya_overlap": 0,
    }


def write_review_sheet(path: Path, rows: list[dict]) -> None:
    fields = [
        "id", "split", "language", "topic", "safety_class", "user_prompt",
        "proposed_response", "reviewer_1_id", "reviewer_1_decision", "reviewer_1_notes",
        "reviewer_2_id", "reviewer_2_decision", "reviewer_2_notes", "adjudicator_id",
        "final_decision", "revised_response", "final_notes",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "id": row["id"],
                    "split": row["split"],
                    "language": row["language"],
                    "topic": row["topic"],
                    "safety_class": row["safety_class"],
                    "user_prompt": row["messages"][0]["content"],
                    "proposed_response": row["messages"][1]["content"],
                    "reviewer_1_id": "",
                    "reviewer_1_decision": "",
                    "reviewer_1_notes": "",
                    "reviewer_2_id": "",
                    "reviewer_2_decision": "",
                    "reviewer_2_notes": "",
                    "adjudicator_id": "",
                    "final_decision": "",
                    "revised_response": "",
                    "final_notes": "",
                }
            )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = build_rows()
    summary = validate(rows)
    outputs = {
        "draft_combined.jsonl": rows,
        "draft_train.jsonl": [row for row in rows if row["split"] == "train"],
        "draft_validation.jsonl": [row for row in rows if row["split"] == "validation"],
    }
    for filename, output_rows in outputs.items():
        write_jsonl(OUT_DIR / filename, output_rows)
    write_review_sheet(OUT_DIR / "clinical_review.csv", rows)

    manifest = {
        "dataset_id": "medora/maya-navigation-sft-v1-draft",
        "generated_by": "tools/maya_dataset/build_synthetic_navigation_dataset.py",
        "status": "pending_clinical_review_not_training_ready",
        "summary": summary,
        "sources": SOURCE_URLS,
        "files": {
            filename: {"rows": len(output_rows), "sha256": sha256(OUT_DIR / filename)}
            for filename, output_rows in outputs.items()
        },
    }
    manifest["files"]["clinical_review.csv"] = {
        "rows": len(rows),
        "sha256": sha256(OUT_DIR / "clinical_review.csv"),
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
