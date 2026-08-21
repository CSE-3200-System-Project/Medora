"""Sentence frames for the synthetic PHI corpus, in three scripts.

Each entry is one *meaning* realised in Bangla, English and romanised Banglish. Writing
them as a triple rather than three independent lists keeps the three scripts genuinely
parallel: any per-script gap in the model's recall is then a property of the model, not
of a corpus that happened to be richer in one script.

The frames are drawn from Medora's own traffic shapes — consultation messages,
appointment requests, prescription and report headers, referral notes, and chat turns to
Chorui — because a de-identifier trained on medical-record prose fails on chat, and chat
is where most of this text arrives.

Slot syntax
-----------
`{NAME}` and the other upper-case slots are **tagged** spans: their character offsets
become gold labels. Lower-case slots (`{drug}`, `{age_ordinary}`, `{dept}`, `{symptom}`,
`{lookalike}`) are **hard negatives** — they are substituted into the sentence and must
carry no tag at all. A frame that mentions a medication next to a patient name is exactly
the case where an under-trained recogniser redacts the medication.

`{age_ordinary}` deserves its own note. An age below 90 is not identifying and is not
tagged; `{AGE}` is only ever filled with 90 or above. Both shapes appear in the same
frames, so the model cannot learn "a number after the word 'age' is PHI" — it has to
learn the threshold, which is the actual rule.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Untagged clinical vocabulary used to fill hard-negative slots
# ---------------------------------------------------------------------------

SYMPTOMS_BN = [
    "তিন দিন ধরে জ্বর", "বুকে ব্যথা", "শ্বাসকষ্ট", "মাথা ঘোরা", "পেটে ব্যথা",
    "কাশি ও গলা ব্যথা", "হাত-পা ফুলে যাওয়া", "ঘুম না হওয়া", "বমি বমি ভাব",
    "পিঠে ব্যথা", "চোখে ঝাপসা দেখা", "খাবারে অরুচি",
]
SYMPTOMS_EN = [
    "fever for three days", "chest pain", "shortness of breath", "dizziness",
    "abdominal pain", "cough and sore throat", "swelling in the legs", "poor sleep",
    "nausea", "back pain", "blurred vision", "loss of appetite",
]
SYMPTOMS_ROM = [
    "tin din dhore jor", "buke betha", "shashkoshto", "matha ghora", "pete betha",
    "kashi ar gola betha", "haat pa fule jaoa", "ghum hoy na", "bomi bomi bhab",
    "pithe betha", "chokhe jhapsa dekha", "khabare oruchi",
]

ADVICE_BN = [
    "বিশ্রাম নিতে বলা হয়েছে", "সাত দিন পর ফলোআপ", "পরীক্ষা করাতে বলা হয়েছে",
    "খাওয়ার পর একটি ট্যাবলেট", "প্রচুর পানি পান করতে হবে", "প্রয়োজনে আবার আসবেন",
]
ADVICE_EN = [
    "advised rest", "follow up after seven days", "investigations advised",
    "one tablet after food", "advised to drink plenty of fluids", "review if symptoms persist",
]
ADVICE_ROM = [
    "bishram nite bola hoyeche", "shat din por follow up", "test korate bola hoyeche",
    "khaoar por ekta tablet", "onek pani khete hobe", "dorkar hole abar ashben",
]

# ---------------------------------------------------------------------------
# PHI-bearing frames. Density varies from one tagged slot to five.
# ---------------------------------------------------------------------------
# Keys: bn / en / rom. Every triple must use the same tagged slots so the three scripts
# stay comparable; the hard-negative slots may differ where the idiom differs.

PHI_FRAMES: list[dict[str, str]] = [
    {
        "bn": "রোগী {NAME}, বয়স {age_ordinary}, {ADDRESS} থেকে এসেছেন। মোবাইল {PHONE}।",
        "en": "Patient {NAME}, age {age_ordinary}, from {ADDRESS}. Mobile {PHONE}.",
        "rom": "Patient {NAME}, boyosh {age_ordinary}, {ADDRESS} theke eshechen. Mobile {PHONE}.",
    },
    {
        "bn": "{NAME} এর {symptom} রয়েছে, {advice}।",
        "en": "{NAME} has {symptom}, {advice}.",
        "rom": "{NAME} er {symptom} ache, {advice}.",
    },
    {
        "bn": "{DOCTOR} দেখেছেন {dept} বিভাগে, {advice}।",
        "en": "Seen by {DOCTOR} in {dept}, {advice}.",
        "rom": "{DOCTOR} dekhechen {dept} e, {advice}.",
    },
    {
        "bn": "রোগীর নামঃ {NAME}। জন্ম তারিখ {DATE}। জাতীয় পরিচয়পত্র নং {NID}।",
        "en": "Patient name: {NAME}. Date of birth {DATE}. NID no {NID}.",
        "rom": "Rogir nam: {NAME}. Jonmo tarikh {DATE}. NID no {NID}.",
    },
    {
        "bn": "{HOSPITAL} এ ভর্তি হয়েছেন {DATE} তারিখে, {symptom} নিয়ে।",
        "en": "Admitted to {HOSPITAL} on {DATE} with {symptom}.",
        "rom": "{HOSPITAL} e bhorti hoyechen {DATE} e, {symptom} niye.",
    },
    {
        "bn": "যোগাযোগ {EMAIL} অথবা {PHONE}। {advice}।",
        "en": "Contact {EMAIL} or {PHONE}. {advice}.",
        "rom": "Jogajog {EMAIL} othoba {PHONE}. {advice}.",
    },
    {
        "bn": "রেজিস্ট্রেশন নং {MRN}, {HOSPITAL}, {dept} বিভাগ।",
        "en": "Registration no {MRN}, {HOSPITAL}, {dept} department.",
        "rom": "Registration no {MRN}, {HOSPITAL}, {dept} department.",
    },
    {
        "bn": "{NAME} কে {drug} দেওয়া হয়েছে, {advice}।",
        "en": "{NAME} was started on {drug}, {advice}.",
        "rom": "{NAME} ke {drug} deoa hoyeche, {advice}.",
    },
    {
        "bn": "{DOCTOR} {drug} লিখেছেন। রোগী {NAME}, বয়স {age_ordinary}।",
        "en": "{DOCTOR} prescribed {drug}. Patient {NAME}, age {age_ordinary}.",
        "rom": "{DOCTOR} {drug} likhechen. Patient {NAME}, boyosh {age_ordinary}.",
    },
    {
        "bn": "ঠিকানাঃ {ADDRESS}। ফোন {PHONE}। {advice}।",
        "en": "Address: {ADDRESS}. Phone {PHONE}. {advice}.",
        "rom": "Thikana: {ADDRESS}. Phone {PHONE}. {advice}.",
    },
    {
        "bn": "আমার নাম {NAME}, আমি {ADDRESS} থেকে বলছি। {symptom} হচ্ছে।",
        "en": "My name is {NAME}, I am calling from {ADDRESS}. I have {symptom}.",
        "rom": "Amar nam {NAME}, ami {ADDRESS} theke bolchi. {symptom} hocche.",
    },
    {
        "bn": "{DATE} তারিখে {DOCTOR} এর সাথে অ্যাপয়েন্টমেন্ট চাই।",
        "en": "I want an appointment with {DOCTOR} on {DATE}.",
        "rom": "{DATE} tarikhe {DOCTOR} er sathe appointment chai.",
    },
    {
        "bn": "{NAME} ({age_ordinary}) {symptom} নিয়ে {HOSPITAL} এ এসেছেন।",
        "en": "{NAME} ({age_ordinary}) presented to {HOSPITAL} with {symptom}.",
        "rom": "{NAME} ({age_ordinary}) {symptom} niye {HOSPITAL} e eshechen.",
    },
    {
        "bn": "রিপোর্ট নং {MRN} — {NAME}, {DATE}। {lookalike} নেগেটিভ।",
        "en": "Report no {MRN} — {NAME}, {DATE}. {lookalike} negative.",
        "rom": "Report no {MRN} — {NAME}, {DATE}. {lookalike} negative.",
    },
    {
        "bn": "বয়স {AGE} বছর, {symptom}। {advice}।",
        "en": "Age {AGE} years, {symptom}. {advice}.",
        "rom": "Boyosh {AGE} bochor, {symptom}. {advice}.",
    },
    {
        "bn": "{NAME}, বয়স {AGE}, {ADDRESS}। {drug} চালিয়ে যেতে বলা হয়েছে।",
        "en": "{NAME}, age {AGE}, {ADDRESS}. Advised to continue {drug}.",
        "rom": "{NAME}, boyosh {AGE}, {ADDRESS}. {drug} chaliye jete bola hoyeche.",
    },
    {
        "bn": "অভিভাবক {NAME}, মোবাইল {PHONE}। শিশুর {symptom}।",
        "en": "Guardian {NAME}, mobile {PHONE}. The child has {symptom}.",
        "rom": "Obhibhabok {NAME}, mobile {PHONE}. Shishur {symptom}.",
    },
    {
        "bn": "{HOSPITAL} থেকে {HOSPITAL} এ রেফার করা হয়েছে {DATE} তারিখে।",
        "en": "Referred from {HOSPITAL} to {HOSPITAL} on {DATE}.",
        "rom": "{HOSPITAL} theke {HOSPITAL} e refer kora hoyeche {DATE} e.",
    },
    {
        "bn": "ইমেইল {EMAIL} এ রিপোর্ট পাঠাবেন। রোগী {NAME}।",
        "en": "Please send the report to {EMAIL}. Patient {NAME}.",
        "rom": "Email {EMAIL} e report pathaben. Patient {NAME}.",
    },
    {
        "bn": "এনআইডি {NID}, জন্ম {DATE}, ঠিকানা {ADDRESS}।",
        "en": "NID {NID}, born {DATE}, address {ADDRESS}.",
        "rom": "NID {NID}, jonmo {DATE}, thikana {ADDRESS}.",
    },
    {
        "bn": "{DOCTOR} এর চেম্বার {HOSPITAL}, সিরিয়ালের জন্য {PHONE}।",
        "en": "{DOCTOR} sits at {HOSPITAL}, call {PHONE} for a serial.",
        "rom": "{DOCTOR} er chamber {HOSPITAL}, serial er jonno {PHONE}.",
    },
    {
        "bn": "{NAME} এর {drug} শেষ হয়ে গেছে, নতুন প্রেসক্রিপশন লাগবে।",
        "en": "{NAME} has run out of {drug} and needs a new prescription.",
        "rom": "{NAME} er {drug} shesh hoye geche, notun prescription lagbe.",
    },
    {
        "bn": "{ADDRESS} এলাকার রোগী {NAME}, {symptom}, {advice}।",
        "en": "Patient {NAME} from {ADDRESS}, {symptom}, {advice}.",
        "rom": "{ADDRESS} elakar rogi {NAME}, {symptom}, {advice}.",
    },
    {
        "bn": "চার্ট {MRN}: {symptom} উন্নতি হচ্ছে, {drug} চলবে।",
        "en": "Chart {MRN}: {symptom} improving, continue {drug}.",
        "rom": "Chart {MRN}: {symptom} unnoti hocche, {drug} cholbe.",
    },
    {
        "bn": "{DATE} তারিখের ভিজিটে {DOCTOR} {dept} এ পাঠিয়েছেন।",
        "en": "At the visit on {DATE}, {DOCTOR} referred to {dept}.",
        "rom": "{DATE} tarikher visit e {DOCTOR} {dept} e pathiyechen.",
    },
    {
        "bn": "রোগী {NAME}, এনআইডি {NID}, মোবাইল {PHONE}, {HOSPITAL}, ভর্তি {DATE}।",
        "en": "Patient {NAME}, NID {NID}, mobile {PHONE}, {HOSPITAL}, admitted {DATE}.",
        "rom": "Patient {NAME}, NID {NID}, mobile {PHONE}, {HOSPITAL}, bhorti {DATE}.",
    },
    {
        "bn": "{NAME} এবং {NAME} একই পরিবারের, দুজনেরই {symptom}।",
        "en": "{NAME} and {NAME} are from the same household, both have {symptom}.",
        "rom": "{NAME} ebong {NAME} ekoi poribarer, dujoneri {symptom}.",
    },
    {
        "bn": "{lookalike} পরীক্ষার জন্য {HOSPITAL} এ যেতে হবে, খরচ জানতে {PHONE}।",
        "en": "For the {lookalike} you must go to {HOSPITAL}; call {PHONE} for the cost.",
        "rom": "{lookalike} porikkhar jonno {HOSPITAL} e jete hobe, khoroch jante {PHONE}.",
    },
    {
        "bn": "প্রেসক্রিপশন: {drug}, {drug}। রোগী {NAME}, তারিখ {DATE}।",
        "en": "Prescription: {drug}, {drug}. Patient {NAME}, date {DATE}.",
        "rom": "Prescription: {drug}, {drug}. Patient {NAME}, tarikh {DATE}.",
    },
    {
        "bn": "{NAME} কে {DATE} তারিখে {HOSPITAL} এর {dept} বিভাগে ভর্তি করা হয়।",
        "en": "{NAME} was admitted to the {dept} department of {HOSPITAL} on {DATE}.",
        "rom": "{NAME} ke {DATE} tarikhe {HOSPITAL} er {dept} bibhage bhorti kora hoy.",
    },
    {
        "bn": "আমার বাবার নাম {NAME}, বয়স {AGE}, {symptom}। কী করব?",
        "en": "My father's name is {NAME}, age {AGE}, with {symptom}. What should I do?",
        "rom": "Amar babar nam {NAME}, boyosh {AGE}, {symptom}. Ki korbo?",
    },
    {
        "bn": "{MRN} নম্বরে {DOCTOR} এর রিপোর্ট আছে, {EMAIL} এ পাঠান।",
        "en": "The report from {DOCTOR} is under {MRN}, send it to {EMAIL}.",
        "rom": "{MRN} number e {DOCTOR} er report ache, {EMAIL} e pathan.",
    },
    {
        "bn": "ফলোআপ {DATE}, {HOSPITAL}, {dept}। {drug} চালিয়ে যান।",
        "en": "Follow-up {DATE}, {HOSPITAL}, {dept}. Continue {drug}.",
        "rom": "Follow-up {DATE}, {HOSPITAL}, {dept}. {drug} chaliye jan.",
    },
    {
        "bn": "{NAME} গতকাল {ADDRESS} থেকে ফোন করেছিলেন {PHONE} নম্বর থেকে।",
        "en": "{NAME} called yesterday from {ADDRESS} on {PHONE}.",
        "rom": "{NAME} gotokal {ADDRESS} theke phone korechilen {PHONE} number theke.",
    },
    {
        "bn": "{DOCTOR}, {dept}, {HOSPITAL} — {advice}।",
        "en": "{DOCTOR}, {dept}, {HOSPITAL} — {advice}.",
        "rom": "{DOCTOR}, {dept}, {HOSPITAL} — {advice}.",
    },
]

# ---------------------------------------------------------------------------
# Zero-PHI frames. A model trained only on PHI-rich text invents entities in clean
# text, so a meaningful share of the corpus must contain nothing to find.
# ---------------------------------------------------------------------------

CLEAN_FRAMES: list[dict[str, str]] = [
    {
        "bn": "{symptom} তিন দিন ধরে চলছে, {advice}।",
        "en": "{symptom} has continued for three days, {advice}.",
        "rom": "{symptom} tin din dhore cholche, {advice}.",
    },
    {
        "bn": "{drug} খাওয়ার পর সামান্য পেট খারাপ হয়েছে।",
        "en": "Mild stomach upset after taking {drug}.",
        "rom": "{drug} khaoar por olpo pet kharap hoyeche.",
    },
    {
        "bn": "{dept} বিভাগে সিরিয়াল পাওয়া যাচ্ছে না।",
        "en": "No serial is available in {dept}.",
        "rom": "{dept} e serial paoa jacche na.",
    },
    {
        "bn": "{lookalike} রিপোর্ট স্বাভাবিক এসেছে।",
        "en": "The {lookalike} came back normal.",
        "rom": "{lookalike} report normal esheche.",
    },
    {
        "bn": "রোগীর বয়স {age_ordinary} বছর, ওজন স্থিতিশীল।",
        "en": "The patient is {age_ordinary} years old and weight is stable.",
        "rom": "Rogir boyosh {age_ordinary} bochor, ojon thik ache.",
    },
    {
        "bn": "{drug} এবং {drug} একসাথে খাওয়া যাবে কি?",
        "en": "Can {drug} and {drug} be taken together?",
        "rom": "{drug} ar {drug} eksathe khaoa jabe ki?",
    },
    {
        "bn": "কোনো ঠিকানা রেকর্ড করা হয়নি।",
        "en": "No address was recorded for this visit.",
        "rom": "Kono thikana record kora hoyni.",
    },
    {
        "bn": "{symptom} এর জন্য কোন বিভাগে যাব?",
        "en": "Which department should I go to for {symptom}?",
        "rom": "{symptom} er jonno kon department e jabo?",
    },
    {
        "bn": "রিপোর্টে নাম লেখা নেই, শুধু ফলাফল আছে।",
        "en": "The report has no name on it, only the result.",
        "rom": "Report e nam lekha nei, shudhu result ache.",
    },
    {
        "bn": "{drug} এর দাম কত এবং কোথায় পাওয়া যায়?",
        "en": "How much does {drug} cost and where is it available?",
        "rom": "{drug} er dam koto ar kothay paoa jay?",
    },
    {
        "bn": "{dept} বিভাগ সকাল আটটা থেকে খোলা থাকে।",
        "en": "The {dept} department opens at eight in the morning.",
        "rom": "{dept} department shokal attar theke khola thake.",
    },
    {
        "bn": "{symptom} এর সাথে জ্বর নেই, {advice}।",
        "en": "There is no fever alongside {symptom}, {advice}.",
        "rom": "{symptom} er sathe jor nei, {advice}.",
    },
    {
        "bn": "{lookalike} পরীক্ষা এখানে করা হয় না।",
        "en": "The {lookalike} is not performed here.",
        "rom": "{lookalike} porikkha ekhane kora hoy na.",
    },
    {
        "bn": "প্রেসক্রিপশনের ছবি স্পষ্ট নয়, আবার তুলুন।",
        "en": "The prescription photo is not clear, please retake it.",
        "rom": "Prescription er chobi shposhto noy, abar tulun.",
    },
]

TAGGED_SLOTS = ("NAME", "DOCTOR", "PHONE", "NID", "ADDRESS", "DATE", "AGE",
                "HOSPITAL", "EMAIL", "MRN")
