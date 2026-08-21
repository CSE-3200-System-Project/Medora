"""Slot fillers for the synthetic Bangla/English/romanised PHI corpus.

Everything a template can substitute lives here, as reviewable data rather than as a
scraped table nobody reads. Two rules govern this file:

1. **Nothing here is a real person, phone number, NID, email address or record number.**
   Names are common Bangladeshi given names and surnames — the shared vocabulary of a
   population, not identifiers of anyone. Numbers are generated from published operator
   prefixes and length rules, never sampled from traffic. The corpus is publishable for
   exactly this reason: rebuilding it never requires touching patient data.

2. **Administrative geography is stated at the coverage it actually has.** All eight
   divisions and all sixty-four districts are present. Upazilas are a named subset, not
   the full 495, and `UPAZILA_COVERAGE` says so rather than implying completeness. A
   generator that quietly claims national coverage manufactures a property of the corpus.

Name entries are authored as `(bengali, latin, latin_variant)` triples so the same person
slot can be realised in all three scripts without a general transliterator guessing. The
variant column carries the real spelling instability of Bangladeshi Latin transcription
(Chowdhury / Choudhury, Mohammad / Muhammad), which is precisely the noise a learned
recogniser has to survive and a gazetteer cannot enumerate.

Hard negatives — drug names that must never be redacted — are loaded from the Akkhor
dataset at generation time (see `hard_negative_drugs`), not copied here, so they track
the shipped medicine reference rather than a stale snapshot of it.
"""

from __future__ import annotations

import csv
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MEDICINE_CSV = ROOT / "data" / "medicine_reference" / "Final_Medicine_Dataset.csv"

BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯"


def to_bengali_digits(value: str) -> str:
    return "".join(BENGALI_DIGITS[int(ch)] if ch.isdigit() else ch for ch in value)


# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------
# (bengali, latin, latin_variant_or_None). Common given names, both Muslim- and
# Hindu-majority Bangladeshi naming traditions, plus the honorific-prone forms.

GIVEN_NAMES: list[tuple[str, str, str | None]] = [
    ("রহিম", "Rahim", None), ("করিম", "Karim", "Kareem"),
    ("রহিমা", "Rahima", None), ("সালমা", "Salma", None),
    ("কামরুল", "Kamrul", None), ("কামাল", "Kamal", None),
    ("জামাল", "Jamal", None), ("বেলাল", "Belal", "Bilal"),
    ("নুসরাত", "Nusrat", None), ("শাহিন", "Shahin", "Shaheen"),
    ("আয়েশা", "Ayesha", "Aisha"), ("তারিক", "Tariq", "Tarek"),
    ("ফারজানা", "Farzana", None), ("ফাতেমা", "Fatema", "Fatima"),
    ("জাহানারা", "Jahanara", None), ("নাজমা", "Nazma", None),
    ("শাহানা", "Shahana", None), ("রিনা", "Rina", "Reena"),
    ("আব্দুল", "Abdul", "Abdool"), ("মোহাম্মদ", "Mohammad", "Muhammad"),
    ("সাব্বির", "Sabbir", "Sabir"), ("তাসনিম", "Tasnim", "Tasneem"),
    ("রিফাত", "Rifat", None), ("নাবিলা", "Nabila", None),
    ("আরিফ", "Arif", "Areef"), ("সুমাইয়া", "Sumaiya", "Sumaia"),
    ("ইমরান", "Imran", None), ("সাদিয়া", "Sadia", "Saadia"),
    ("মাহমুদ", "Mahmud", "Mahmood"), ("রুবেল", "Rubel", None),
    ("শাকিল", "Shakil", "Shakeel"), ("তানভীর", "Tanvir", "Tanveer"),
    ("সাইফুল", "Saiful", None), ("মিজানুর", "Mizanur", None),
    ("আনোয়ার", "Anwar", "Anowar"), ("মোস্তফা", "Mostafa", "Mustafa"),
    ("রেজাউল", "Rezaul", None), ("হাবিব", "Habib", None),
    ("নাসরিন", "Nasrin", "Nasreen"), ("শিরিন", "Shirin", "Shireen"),
    ("রোকসানা", "Roksana", "Rokhsana"), ("দিলরুবা", "Dilruba", None),
    ("মুনমুন", "Munmun", None), ("তানিয়া", "Tania", "Taniya"),
    ("সুলতানা", "Sultana", None), ("রুমানা", "Rumana", None),
    ("আফরোজা", "Afroza", "Afroja"), ("নার্গিস", "Nargis", None),
    ("বিলকিস", "Bilkis", "Bilqis"), ("মরিয়ম", "Mariam", "Maryam"),
    ("সোহেল", "Sohel", "Suhel"), ("রাসেল", "Rasel", "Russell"),
    ("মাসুদ", "Masud", "Masood"), ("ফরিদ", "Farid", "Fareed"),
    ("জাহিদ", "Zahid", "Jahid"), ("নাঈম", "Naim", "Naeem"),
    ("সাজিদ", "Sajid", None), ("রায়হান", "Raihan", "Rayhan"),
    ("আসিফ", "Asif", None), ("ফাহিম", "Fahim", "Faheem"),
    ("তৌহিদ", "Touhid", "Tawhid"), ("শামীম", "Shamim", "Shameem"),
    ("দেলোয়ার", "Delwar", "Dilwar"), ("মনির", "Monir", "Munir"),
    ("বাবুল", "Babul", None), ("জসিম", "Jasim", "Jashim"),
    ("সেলিম", "Selim", "Salim"), ("হারুন", "Harun", "Haroon"),
    ("লিটন", "Liton", "Litton"), ("সুমন", "Sumon", "Suman"),
    ("পলাশ", "Palash", None), ("বিপ্লব", "Biplob", "Biplab"),
    ("অরুণ", "Arun", "Orun"), ("দীপক", "Dipak", "Deepak"),
    ("সুব্রত", "Subrata", "Shubrata"), ("তাপস", "Tapas", "Tapash"),
    ("প্রদীপ", "Pradip", "Prodip"), ("অমিত", "Amit", "Omit"),
    ("রঞ্জন", "Ranjan", "Ronjon"), ("বিকাশ", "Bikash", "Bikas"),
    ("সঞ্জয়", "Sanjoy", "Sanjay"), ("গৌতম", "Goutam", "Gautam"),
    ("সুশান্ত", "Sushanta", "Shushanto"), ("নিতাই", "Nitai", None),
    ("অনিমা", "Anima", "Onima"), ("সবিতা", "Sabita", "Sobita"),
    ("মিতা", "Mita", "Meeta"), ("শিপ্রা", "Shipra", None),
    ("কল্পনা", "Kalpana", "Kolpona"), ("রুপা", "Rupa", "Roopa"),
    ("চন্দনা", "Chandana", "Chondona"), ("অর্চনা", "Archana", "Orchona"),
    ("লাবণী", "Laboni", "Labony"), ("পূর্ণিমা", "Purnima", "Poornima"),
    ("শাহরিয়ার", "Shahriar", "Shahriyar"), ("ইশরাত", "Ishrat", None),
    ("তাহমিনা", "Tahmina", None), ("মেহজাবিন", "Mehjabin", "Mehzabin"),
    ("সানজিদা", "Sanjida", None), ("তামান্না", "Tamanna", None),
    ("জান্নাত", "Jannat", "Jannath"), ("মাহফুজ", "Mahfuz", "Mahfooz"),
    ("রাকিব", "Rakib", "Raqib"), ("সাকিব", "Sakib", "Shakib"),
    ("নাহিদ", "Nahid", None), ("ওয়াহিদ", "Wahid", "Ohid"),
    ("জুবায়ের", "Zubair", "Jubayer"), ("মুশফিক", "Mushfiq", "Mushfique"),
    ("তানজিম", "Tanzim", "Tanjim"), ("আফসানা", "Afsana", None),
    ("সাদমান", "Sadman", None), ("রুবাইয়া", "Rubaiya", None),
    ("নাফিসা", "Nafisa", None), ("সামিয়া", "Samia", "Samiya"),
    ("তাসফিয়া", "Tasfia", "Tasfiya"), ("আরাফাত", "Arafat", None),
    ("জিসান", "Jisan", "Zisan"), ("তুহিন", "Tuhin", None),
    ("পারভীন", "Parvin", "Parveen"), ("ইয়াসমিন", "Yasmin", "Jasmin"),
    ("রেহানা", "Rehana", None), ("মাহবুবা", "Mahbuba", None),
    ("কহিনূর", "Kohinoor", "Kohinur"), ("ছালেহা", "Saleha", None),
    ("আনজুমান", "Anjuman", None), ("মোরশেদা", "Morsheda", None),
]

SURNAMES: list[tuple[str, str, str | None]] = [
    ("হাসান", "Hasan", "Hassan"), ("হোসেন", "Hossain", "Hussain"),
    ("আহমেদ", "Ahmed", "Ahamed"), ("ইসলাম", "Islam", None),
    ("উদ্দিন", "Uddin", "Uddeen"), ("খান", "Khan", None),
    ("আক্তার", "Akter", "Aktar"), ("বেগম", "Begum", "Begom"),
    ("জাহান", "Jahan", "Jahaan"), ("চৌধুরী", "Chowdhury", "Choudhury"),
    ("সিদ্দিকী", "Siddiqui", "Siddique"), ("আলম", "Alam", None),
    ("মিয়া", "Mia", "Miah"), ("সরকার", "Sarkar", "Sorkar"),
    ("দাস", "Das", "Dash"), ("রায়", "Roy", "Ray"),
    ("শেখ", "Sheikh", "Shek"), ("ভূঁইয়া", "Bhuiyan", "Bhuiya"),
    ("রহমান", "Rahman", "Rehman"), ("হক", "Haque", "Huq"),
    ("তালুকদার", "Talukder", "Talukdar"), ("সাহা", "Saha", "Shaha"),
    ("ঘোষ", "Ghosh", "Ghose"), ("চক্রবর্তী", "Chakraborty", "Chakravarty"),
    ("মৃধা", "Mridha", "Mrida"), ("পোদ্দার", "Podder", "Poddar"),
    ("বিশ্বাস", "Biswas", "Bishwas"), ("মণ্ডল", "Mondol", "Mandal"),
    ("পাল", "Pal", "Paul"), ("দত্ত", "Dutta", "Datta"),
    ("বসু", "Bosu", "Basu"), ("সেন", "Sen", "Sen"),
    ("গোস্বামী", "Goswami", None), ("ভট্টাচার্য", "Bhattacharya", "Bhattacharjee"),
    ("মজুমদার", "Majumder", "Mazumdar"), ("হাওলাদার", "Howlader", "Haolader"),
    ("সিকদার", "Sikder", "Shikder"), ("গাজী", "Gazi", "Ghazi"),
    ("মোল্লা", "Molla", "Mollah"), ("প্রামাণিক", "Pramanik", "Pramanick"),
    ("কবির", "Kabir", "Kobir"), ("আনসারী", "Ansari", None),
    ("ফারুক", "Faruk", "Farooq"), ("জামান", "Zaman", "Jaman"),
    ("মাহমুদ", "Mahmud", "Mahmood"), ("নাথ", "Nath", None),
    ("বর্মণ", "Barman", "Borman"), ("দেব", "Deb", "Dev"),
    ("কর", "Kar", None), ("সরদার", "Sardar", "Sordar"),
    ("খন্দকার", "Khandaker", "Khondokar"), ("মুন্সী", "Munshi", "Munsi"),
    ("ব্যাপারী", "Bepari", "Byapari"), ("হাজারী", "Hazari", "Hajari"),
    ("তরফদার", "Tarafdar", "Torofdar"), ("লস্কর", "Laskar", "Loshkor"),
    ("ভুঁঞা", "Bhuiya", None), ("কাজী", "Kazi", "Qazi"),
    ("শিকদার", "Shikdar", None), ("চাকমা", "Chakma", None),
    ("মারমা", "Marma", None), ("ত্রিপুরা", "Tripura", None),
]

HONORIFICS_BN = ["ডাঃ", "ডা.", "ড.", "অধ্যাপক", "প্রফেসর"]
HONORIFICS_EN = ["Dr.", "Dr", "Prof.", "Professor", "Assoc. Prof."]

# ---------------------------------------------------------------------------
# Administrative geography
# ---------------------------------------------------------------------------

DIVISIONS: list[tuple[str, str]] = [
    ("ঢাকা", "Dhaka"), ("চট্টগ্রাম", "Chattogram"), ("রাজশাহী", "Rajshahi"),
    ("খুলনা", "Khulna"), ("বরিশাল", "Barishal"), ("সিলেট", "Sylhet"),
    ("রংপুর", "Rangpur"), ("ময়মনসিংহ", "Mymensingh"),
]

DISTRICTS: list[tuple[str, str]] = [
    # Dhaka division (13)
    ("ঢাকা", "Dhaka"), ("গাজীপুর", "Gazipur"), ("কিশোরগঞ্জ", "Kishoreganj"),
    ("মানিকগঞ্জ", "Manikganj"), ("মুন্সিগঞ্জ", "Munshiganj"), ("নারায়ণগঞ্জ", "Narayanganj"),
    ("নরসিংদী", "Narsingdi"), ("টাঙ্গাইল", "Tangail"), ("ফরিদপুর", "Faridpur"),
    ("গোপালগঞ্জ", "Gopalganj"), ("মাদারীপুর", "Madaripur"), ("রাজবাড়ী", "Rajbari"),
    ("শরীয়তপুর", "Shariatpur"),
    # Chattogram division (11)
    ("চট্টগ্রাম", "Chattogram"), ("কক্সবাজার", "Cox's Bazar"), ("বান্দরবান", "Bandarban"),
    ("রাঙ্গামাটি", "Rangamati"), ("খাগড়াছড়ি", "Khagrachhari"), ("ফেনী", "Feni"),
    ("লক্ষ্মীপুর", "Lakshmipur"), ("নোয়াখালী", "Noakhali"), ("কুমিল্লা", "Cumilla"),
    ("চাঁদপুর", "Chandpur"), ("ব্রাহ্মণবাড়িয়া", "Brahmanbaria"),
    # Rajshahi division (8)
    ("রাজশাহী", "Rajshahi"), ("নাটোর", "Natore"), ("নওগাঁ", "Naogaon"),
    ("চাঁপাইনবাবগঞ্জ", "Chapainawabganj"), ("পাবনা", "Pabna"), ("সিরাজগঞ্জ", "Sirajganj"),
    ("বগুড়া", "Bogura"), ("জয়পুরহাট", "Joypurhat"),
    # Khulna division (10)
    ("খুলনা", "Khulna"), ("বাগেরহাট", "Bagerhat"), ("সাতক্ষীরা", "Satkhira"),
    ("যশোর", "Jashore"), ("ঝিনাইদহ", "Jhenaidah"), ("মাগুরা", "Magura"),
    ("নড়াইল", "Narail"), ("কুষ্টিয়া", "Kushtia"), ("চুয়াডাঙ্গা", "Chuadanga"),
    ("মেহেরপুর", "Meherpur"),
    # Barishal division (6)
    ("বরিশাল", "Barishal"), ("পটুয়াখালী", "Patuakhali"), ("ভোলা", "Bhola"),
    ("পিরোজপুর", "Pirojpur"), ("বরগুনা", "Barguna"), ("ঝালকাঠি", "Jhalokati"),
    # Sylhet division (4)
    ("সিলেট", "Sylhet"), ("মৌলভীবাজার", "Moulvibazar"), ("হবিগঞ্জ", "Habiganj"),
    ("সুনামগঞ্জ", "Sunamganj"),
    # Rangpur division (8)
    ("রংপুর", "Rangpur"), ("দিনাজপুর", "Dinajpur"), ("ঠাকুরগাঁও", "Thakurgaon"),
    ("পঞ্চগড়", "Panchagarh"), ("নীলফামারী", "Nilphamari"), ("লালমনিরহাট", "Lalmonirhat"),
    ("কুড়িগ্রাম", "Kurigram"), ("গাইবান্ধা", "Gaibandha"),
    # Mymensingh division (4)
    ("ময়মনসিংহ", "Mymensingh"), ("জামালপুর", "Jamalpur"), ("শেরপুর", "Sherpur"),
    ("নেত্রকোণা", "Netrokona"),
]

# A named subset, not the full 495. Stated in the manifest so the corpus never
# implies national upazila coverage it does not have.
UPAZILAS: list[tuple[str, str]] = [
    ("সাভার", "Savar"), ("ধামরাই", "Dhamrai"), ("কেরানীগঞ্জ", "Keraniganj"),
    ("দোহার", "Dohar"), ("নবাবগঞ্জ", "Nawabganj"), ("শ্রীপুর", "Sreepur"),
    ("কালীগঞ্জ", "Kaliganj"), ("কালিয়াকৈর", "Kaliakair"), ("রূপগঞ্জ", "Rupganj"),
    ("সোনারগাঁও", "Sonargaon"), ("আড়াইহাজার", "Araihazar"), ("সিদ্ধিরগঞ্জ", "Siddhirganj"),
    ("মির্জাপুর", "Mirzapur"), ("ঘাটাইল", "Ghatail"), ("সখিপুর", "Sakhipur"),
    ("ভৈরব", "Bhairab"), ("কটিয়াদী", "Katiadi"), ("পাকুন্দিয়া", "Pakundia"),
    ("সীতাকুণ্ড", "Sitakunda"), ("হাটহাজারী", "Hathazari"), ("পটিয়া", "Patiya"),
    ("রাউজান", "Raozan", ), ("ফটিকছড়ি", "Fatikchhari"), ("বাঁশখালী", "Banshkhali"),
    ("রামু", "Ramu"), ("টেকনাফ", "Teknaf"), ("উখিয়া", "Ukhiya"), ("চকরিয়া", "Chakaria"),
    ("বেগমগঞ্জ", "Begumganj"), ("সোনাইমুড়ী", "Sonaimuri"), ("চাটখিল", "Chatkhil"),
    ("দাউদকান্দি", "Daudkandi"), ("চান্দিনা", "Chandina"), ("লাকসাম", "Laksam"),
    ("পুঠিয়া", "Puthia"), ("বাগমারা", "Bagmara"), ("দুর্গাপুর", "Durgapur"),
    ("শাহজাদপুর", "Shahjadpur"), ("উল্লাপাড়া", "Ullapara"), ("বেড়া", "Bera"),
    ("শেরপুর", "Sherpur"), ("শিবগঞ্জ", "Shibganj"), ("গাবতলী", "Gabtali"),
    ("ডুমুরিয়া", "Dumuria"), ("বটিয়াঘাটা", "Batiaghata"), ("পাইকগাছা", "Paikgacha"),
    ("অভয়নগর", "Abhaynagar"), ("ঝিকরগাছা", "Jhikargacha"), ("কেশবপুর", "Keshabpur"),
    ("মোরেলগঞ্জ", "Morrelganj"), ("মোংলা", "Mongla"), ("শরণখোলা", "Sharankhola"),
    ("বাউফল", "Bauphal"), ("কলাপাড়া", "Kalapara"), ("গলাচিপা", "Galachipa"),
    ("গৌরনদী", "Gournadi"), ("বাকেরগঞ্জ", "Bakerganj"), ("বানারীপাড়া", "Banaripara"),
    ("বিয়ানীবাজার", "Beanibazar"), ("গোলাপগঞ্জ", "Golapganj"), ("জৈন্তাপুর", "Jaintiapur"),
    ("শ্রীমঙ্গল", "Sreemangal"), ("কমলগঞ্জ", "Kamalganj"), ("চুনারুঘাট", "Chunarughat"),
    ("পীরগঞ্জ", "Pirganj"), ("বদরগঞ্জ", "Badarganj"), ("মিঠাপুকুর", "Mithapukur"),
    ("পার্বতীপুর", "Parbatipur"), ("বিরামপুর", "Birampur"), ("চিরিরবন্দর", "Chirirbandar"),
    ("ত্রিশাল", "Trishal"), ("ভালুকা", "Bhaluka"), ("মুক্তাগাছা", "Muktagacha"),
    ("সরিষাবাড়ী", "Sarishabari"), ("মাদারগঞ্জ", "Madarganj"), ("নালিতাবাড়ী", "Nalitabari"),
]
UPAZILA_COVERAGE = "named subset (not the full 495 upazilas)"

# Thana / neighbourhood names used inside metropolitan addresses.
CITY_AREAS: list[tuple[str, str]] = [
    ("ধানমন্ডি", "Dhanmondi"), ("মিরপুর", "Mirpur"), ("গুলশান", "Gulshan"),
    ("উত্তরা", "Uttara"), ("বনানী", "Banani"), ("মোহাম্মদপুর", "Mohammadpur"),
    ("মহাখালী", "Mohakhali"), ("মতিঝিল", "Motijheel"), ("বসুন্ধরা", "Bashundhara"),
    ("যাত্রাবাড়ী", "Jatrabari"), ("বাড্ডা", "Badda"), ("রামপুরা", "Rampura"),
    ("খিলগাঁও", "Khilgaon"), ("তেজগাঁও", "Tejgaon"), ("শ্যামলী", "Shyamoli"),
    ("আগ্রাবাদ", "Agrabad"), ("পাঁচলাইশ", "Panchlaish"), ("খুলশী", "Khulshi"),
    ("নাসিরাবাদ", "Nasirabad"), ("হালিশহর", "Halishahar"),
]

ROAD_WORD = [("রোড", "Road"), ("সড়ক", "Road"), ("লেন", "Lane")]
HOUSE_WORD = [("বাসা", "House"), ("বাড়ি", "House"), ("হোল্ডিং", "Holding")]
VILLAGE_WORD = ("গ্রাম", "Village")

# ---------------------------------------------------------------------------
# Facilities
# ---------------------------------------------------------------------------
# A short list of well-known public facilities, plus a compositional generator over the
# district list. Composition is honest synthesis: "<District> Sadar Hospital" is the
# actual naming convention, so the model learns the shape rather than 200 memorised strings.

NAMED_HOSPITALS: list[tuple[str, str]] = [
    ("ঢাকা মেডিকেল কলেজ হাসপাতাল", "Dhaka Medical College Hospital"),
    ("বঙ্গবন্ধু শেখ মুজিব মেডিকেল বিশ্ববিদ্যালয়", "Bangabandhu Sheikh Mujib Medical University"),
    ("জাতীয় হৃদরোগ ইনস্টিটিউট", "National Institute of Cardiovascular Diseases"),
    ("শহীদ সোহরাওয়ার্দী মেডিকেল কলেজ হাসপাতাল", "Shaheed Suhrawardy Medical College Hospital"),
    ("স্যার সলিমুল্লাহ মেডিকেল কলেজ", "Sir Salimullah Medical College"),
    ("চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল", "Chattogram Medical College Hospital"),
    ("রাজশাহী মেডিকেল কলেজ হাসপাতাল", "Rajshahi Medical College Hospital"),
    ("খুলনা মেডিকেল কলেজ হাসপাতাল", "Khulna Medical College Hospital"),
    ("সিলেট এম এ জি ওসমানী মেডিকেল কলেজ হাসপাতাল", "Sylhet MAG Osmani Medical College Hospital"),
    ("ময়মনসিংহ মেডিকেল কলেজ হাসপাতাল", "Mymensingh Medical College Hospital"),
    ("জাতীয় ক্যান্সার গবেষণা ইনস্টিটিউট", "National Institute of Cancer Research and Hospital"),
    ("শিশু হাসপাতাল ও ইনস্টিটিউট", "Bangladesh Shishu Hospital and Institute"),
    ("কুর্মিটোলা জেনারেল হাসপাতাল", "Kurmitola General Hospital"),
    ("মুগদা মেডিকেল কলেজ হাসপাতাল", "Mugda Medical College Hospital"),
    ("ইব্রাহিম কার্ডিয়াক হাসপাতাল", "Ibrahim Cardiac Hospital"),
]

FACILITY_SUFFIXES: list[tuple[str, str]] = [
    ("সদর হাসপাতাল", "Sadar Hospital"),
    ("জেনারেল হাসপাতাল", "General Hospital"),
    ("উপজেলা স্বাস্থ্য কমপ্লেক্স", "Upazila Health Complex"),
    ("মেডিকেল কলেজ হাসপাতাল", "Medical College Hospital"),
    ("মা ও শিশু কল্যাণ কেন্দ্র", "Mother and Child Welfare Centre"),
    ("ডায়াগনস্টিক সেন্টার", "Diagnostic Centre"),
    ("স্পেশালাইজড হাসপাতাল", "Specialized Hospital"),
    ("কমিউনিটি ক্লিনিক", "Community Clinic"),
]


def hospital_pairs() -> list[tuple[str, str]]:
    """Every facility name the corpus may use, Bengali and Latin, deduplicated.

    Composition collides with the named list — "Chattogram Medical College Hospital" is
    both a real facility and what `district + suffix` produces. Left in, those duplicates
    would appear in the train *and* dev pools and quietly break the disjointness the split
    is supposed to guarantee. First occurrence wins; order is deterministic.
    """
    pairs: dict[tuple[str, str], None] = {pair: None for pair in NAMED_HOSPITALS}
    for bn_district, en_district in DISTRICTS:
        for bn_suffix, en_suffix in FACILITY_SUFFIXES:
            pairs.setdefault((f"{bn_district} {bn_suffix}", f"{en_district} {en_suffix}"), None)
    return list(pairs)


# ---------------------------------------------------------------------------
# Numeric identifiers — pattern-generated, never real
# ---------------------------------------------------------------------------

OPERATOR_PREFIXES = ["013", "014", "015", "016", "017", "018", "019"]
MRN_PREFIXES = ["MRN", "REG", "OPD", "IPD", "PT", "HN", "BMDC"]
EMAIL_DOMAINS = ["example.org", "example.com", "example.net", "mail.example",
                 "clinic.example", "hospital.example.bd"]


def phone(rng: random.Random) -> str:
    number = rng.choice(OPERATOR_PREFIXES) + "".join(str(rng.randrange(10)) for _ in range(8))
    shape = rng.randrange(6)
    if shape == 0:
        return number
    if shape == 1:
        return "+880" + number[1:]
    if shape == 2:
        return "880" + number[1:]
    if shape == 3:
        return f"{number[:5]}-{number[5:]}"
    if shape == 4:
        return to_bengali_digits(number)
    return f"{number[:5]} {number[5:]}"


def national_id(rng: random.Random) -> str:
    length = rng.choice([10, 13, 17])
    digits = "".join(str(rng.randrange(10)) for _ in range(length))
    if rng.randrange(4) == 0:
        return to_bengali_digits(digits)
    if length == 17 and rng.randrange(2):
        return f"{digits[:4]} {digits[4:11]} {digits[11:]}"
    return digits


def mrn(rng: random.Random) -> str:
    prefix = rng.choice(MRN_PREFIXES)
    body = "".join(str(rng.randrange(10)) for _ in range(rng.choice([5, 6, 7])))
    joiner = rng.choice(["-", "/", "", " "])
    if prefix == "BMDC":
        return f"BMDC-{rng.choice('ABC')}-{body}"
    return f"{prefix}{joiner}{body}"


def email(rng: random.Random, latin_name: str) -> str:
    handle = re.sub(r"[^a-z0-9]+", rng.choice([".", "_", ""]), latin_name.lower()).strip("._")
    if rng.randrange(3) == 0:
        handle += str(rng.randrange(10, 100))
    return f"{handle}@{rng.choice(EMAIL_DOMAINS)}"


_MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December"]
_MONTHS_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই",
              "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"]


def date(rng: random.Random, *, bengali: bool) -> str:
    day = rng.randrange(1, 29)
    month = rng.randrange(1, 13)
    year = rng.randrange(1955, 2027)
    shape = rng.randrange(6)
    if shape == 0:
        raw = f"{year:04d}-{month:02d}-{day:02d}"
    elif shape == 1:
        raw = f"{day:02d}/{month:02d}/{year:04d}"
    elif shape == 2:
        raw = f"{day}.{month}.{year % 100:02d}"
    elif shape == 3:
        raw = f"{day} {(_MONTHS_BN if bengali else _MONTHS_EN)[month - 1]} {year}"
        return to_bengali_digits(raw) if bengali else raw
    elif shape == 4:
        if bengali:
            raw = f"{day} {_MONTHS_BN[month - 1]} {year}"
            return to_bengali_digits(raw)
        raw = f"{_MONTHS_EN[month - 1]} {day}, {year}"
    else:
        raw = f"{day:02d}-{month:02d}-{year:04d}"
    return to_bengali_digits(raw) if bengali else raw


def identifying_age(rng: random.Random, *, bengali: bool) -> str:
    """An age at or above 90 — identifying under HIPAA-style rules, so it is tagged."""
    value = str(rng.randrange(90, 106))
    return to_bengali_digits(value) if bengali else value


def ordinary_age(rng: random.Random, *, bengali: bool) -> str:
    """An age below 90. Deliberately NOT tagged: a hard negative for the AGE tag."""
    value = str(rng.randrange(1, 90))
    return to_bengali_digits(value) if bengali else value


# ---------------------------------------------------------------------------
# Hard negatives
# ---------------------------------------------------------------------------
# Text that must survive redaction untouched. Without these the model learns that any
# capitalised unfamiliar token is PHI, over-redacts, and destroys the clinical content
# the summary is supposed to be about.

# Clinical vocabulary that shares surface form with names or places.
CLINICAL_LOOKALIKES_EN = [
    "Graves disease", "Crohn's disease", "Bell's palsy", "Parkinson's disease",
    "Hodgkin lymphoma", "Down syndrome", "Addison's disease", "Cushing syndrome",
    "Guillain-Barre syndrome", "Wilson's disease", "Paget's disease", "Meniere's disease",
    "Raynaud phenomenon", "Barrett oesophagus", "Colles fracture", "Murphy's sign",
    "Glasgow Coma Scale", "Apgar score", "Bristol stool chart", "Mantoux test",
    "Widal test", "Rose Bengal stain", "Romberg test", "Charcot joint",
]
CLINICAL_LOOKALIKES_BN = [
    "ডায়াবেটিস", "উচ্চ রক্তচাপ", "হাঁপানি", "থাইরয়েড", "রক্তশূন্যতা",
    "যক্ষ্মা", "ডেঙ্গু জ্বর", "টাইফয়েড", "আমাশয়", "গ্যাস্ট্রিক",
]

# Words that are simultaneously place names and ordinary vocabulary or clinical terms.
PLACE_WORD_COLLISIONS = [
    "Bengal", "Rose", "Green", "Ring", "Mirror", "Court", "Garden", "Park",
    "মে",  # month name and the Bengali word inside other compounds
]

# Departments and roles that sit next to names but are not names.
DEPARTMENTS_EN = ["Cardiology", "Neurology", "Paediatrics", "Orthopaedics", "Dermatology",
                  "Gastroenterology", "Nephrology", "Oncology", "Psychiatry", "Emergency",
                  "Outpatient Department", "Radiology", "Pathology", "Obstetrics"]
DEPARTMENTS_BN = ["কার্ডিওলজি", "নিউরোলজি", "শিশু বিভাগ", "অর্থোপেডিক্স", "চর্মরোগ বিভাগ",
                  "মেডিসিন বিভাগ", "জরুরি বিভাগ", "বহির্বিভাগ", "প্যাথলজি", "রেডিওলজি"]


def hard_negative_drugs(limit: int = 600) -> list[str]:
    """Drug brand and generic names from the Akkhor reference, which must never redact.

    Loaded from the shipped dataset rather than copied into this file so the negatives
    track the medicine reference that is actually deployed. Selection is deterministic
    (first-seen order over a sorted read), never sampled, so the corpus is reproducible.
    """
    if not MEDICINE_CSV.exists():
        raise FileNotFoundError(
            f"Akkhor medicine reference not found at {MEDICINE_CSV}. The corpus requires "
            "drug-name hard negatives; generating without them produces a model that "
            "redacts medication names, which is a clinical-content failure."
        )
    seen: dict[str, None] = {}
    with MEDICINE_CSV.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            for field in ("brand_name", "generic_name"):
                value = (row.get(field) or "").strip()
                # Single tokens with letters only; multi-word generics carry dosage
                # noise ("sodium chloride 9 mg/ml") that is not a name-shaped negative.
                if not value or len(value) < 4 or len(value) > 28:
                    continue
                if not re.fullmatch(r"[A-Za-z][A-Za-z' -]*[A-Za-z]", value):
                    continue
                if value.title() not in seen:
                    seen[value.title()] = None
            if len(seen) >= limit * 3:
                break
    return sorted(seen)[:limit]
