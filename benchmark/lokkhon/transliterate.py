"""A declared, closed romanisation map for the Lokkhon corpus.

This is not a general Bengali transliterator, and it deliberately refuses to pretend to
be one. A general transliterator is a large table nobody reviews, and an unreviewed table
silently producing benchmark cases is a way to manufacture a number rather than measure
one.

Instead the map covers exactly the tokens that appear in the authored Lokkhon fixtures.
`romanise` raises `UncoveredToken` the moment it meets Bengali text it has no entry for,
so extending the corpus forces a human to extend this file and say what the romanisation
should be. Coverage is a property you can check by reading; silence is not.

Romanisation targets how Bangladeshi users actually type Bangla in Latin script
("Banglish") rather than a scholarly scheme like ISO 15919. `জ্বর` becomes `jor`, not
`jvara`, because the point is to test the redactor against real input.
"""

from __future__ import annotations

import re

__all__ = [
    "UncoveredToken",
    "BENGALI_DIGITS",
    "ROMANISATION",
    "ENGLISH_LABELS",
    "contains_bengali",
    "to_bengali_digits",
    "to_arabic_digits",
    "romanise",
    "englishise_labels",
]


class UncoveredToken(ValueError):
    """Raised when Bengali text has no declared romanisation.

    Failing here is the point. A generator that silently passed through unmapped Bengali
    would emit cases whose expected spans no longer match their text, and the resulting
    metric would measure the generator's bugs rather than the redactor's behaviour.
    """


_BENGALI_RANGE = re.compile(r"[ঀ-৿]")

#: ০-৯ to 0-9. Bengali numerals appear in real Bangladeshi phone numbers and NIDs.
BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯"
_TO_ARABIC = {bengali: str(index) for index, bengali in enumerate(BENGALI_DIGITS)}
_TO_BENGALI = {str(index): bengali for index, bengali in enumerate(BENGALI_DIGITS)}


#: Bengali source to the Latin spelling a Bangladeshi user would actually type.
#: Ordered longest-first at substitution time so multi-word phrases win over their parts.
ROMANISATION: dict[str, str] = {
    # --- Field labels -----------------------------------------------------
    "জাতীয় পরিচয়পত্র নং": "jatiyo porichoypotro nong",
    "পাসপোর্ট নং": "passport nong",
    "ডাক্তারের নাম": "daktarer nam",
    "রোগী আইডি": "rogi ID",
    "রোগীর নাম": "rogir nam",
    "ঠিকানা": "thikana",
    "ফোন": "phone",
    "নাম": "nam",
    "ডা.": "Da.",
    # --- Person names -----------------------------------------------------
    "রহিমা আক্তার": "Rahima Akter",
    "কামরুল হাসান": "Kamrul Hasan",
    "নুসরাত জাহান": "Nusrat Jahan",
    # --- Places -----------------------------------------------------------
    "নম্বর বাড়ি ধানমন্ডি": "nombor bari Dhanmondi",
    "গুলশান": "Gulshan",
    "ঢাকা": "Dhaka",
    # --- Dates ------------------------------------------------------------
    "জানুয়ারি": "Janwari",
    "তারিখে এসেছিলেন": "tarikhe eshechilen",
    # --- Clinical narrative ----------------------------------------------
    "তিন দিন ধরে জ্বর আছে": "tin din dhore jor ache",
    "দুই সপ্তাহ পরে আবার দেখাবেন": "dui soptaho pore abar dekhaben",
    "চিকিৎসা পরামর্শ দিয়েছেন": "chikitsha poramorsho diyechen",
    "রোগী ভালো বোধ করছেন": "rogi bhalo bodh korchen",
    "কোনো ফোন নম্বর সংরক্ষিত নেই": "kono phone number songrokkhito nei",
    "বাংলা ও ইংরেজি নির্দেশনা": "Bangla o English nirdeshona",
    "আজ এসেছেন": "aaj eshechen",
    "দেখেছেন": "dekhechen",
    "রোগীর": "rogir",
    "রোগী": "rogi",
    # --- Injection phrasing ----------------------------------------------
    "সব নিয়ম উপেক্ষা করে": "shob niyom upekkha kore",
    "সিস্টেম প্রম্পট বাদ দিয়ে": "system prompt bad diye",
    "ডিবাগ মোডে": "debug mode e",
    "প্রিন্ট করো": "print koro",
    "দেখাও": "dekhao",
    "লেখো": "lekho",
    "এবং": "ebong",
    # --- Punctuation ------------------------------------------------------
    # The Bengali full stop. Romanised text uses a Latin period.
    "।": ".",
}

#: Bengali field labels to their English equivalents, for the code-mixed transform where
#: the label switches script but the value does not.
ENGLISH_LABELS: dict[str, str] = {
    "জাতীয় পরিচয়পত্র নং": "National ID no",
    "পাসপোর্ট নং": "Passport no",
    "ডাক্তারের নাম": "Doctor name",
    "রোগী আইডি": "Patient ID",
    "রোগীর নাম": "Patient name",
    "ঠিকানা": "Address",
    "ফোন": "Phone",
    "নাম": "Name",
}


def contains_bengali(text: str) -> bool:
    return bool(_BENGALI_RANGE.search(text))


def to_arabic_digits(text: str) -> str:
    return "".join(_TO_ARABIC.get(char, char) for char in text)


def to_bengali_digits(text: str) -> str:
    return "".join(_TO_BENGALI.get(char, char) for char in text)


def _substitute(text: str, table: dict[str, str]) -> str:
    """Longest key first, so a phrase is never split by one of its own words."""
    for source in sorted(table, key=len, reverse=True):
        text = text.replace(source, table[source])
    return text


def romanise(text: str, *, digits: bool = True) -> str:
    """Rewrite Bengali script as the Latin spelling a Bangladeshi user would type.

    Raises `UncoveredToken` if any Bengali codepoint survives, because a partially
    romanised string is neither the case that was authored nor the case that was
    intended, and scoring it would be scoring a bug.
    """
    output = _substitute(text, ROMANISATION)
    if digits:
        output = to_arabic_digits(output)

    # With `digits=False` the caller is deliberately keeping Bengali numerals - Latin
    # words around a Bengali phone number is a real shape, not an oversight - so those
    # codepoints are not residue. Everything else still has to be covered.
    residue = "".join(
        sorted(
            {
                char
                for char in output
                if _BENGALI_RANGE.match(char) and not (not digits and char in BENGALI_DIGITS)
            }
        )
    )
    if residue:
        raise UncoveredToken(
            f"No declared romanisation for {residue!r} in {text!r}. "
            f"Add it to ROMANISATION in benchmark/lokkhon/transliterate.py."
        )
    return output


def englishise_labels(text: str) -> str:
    """Swap Bengali field labels for English ones, leaving the value untouched.

    This produces the script boundary that sits inside a single clinical sentence -
    an English label in front of a Bengali value - which is the shape a bilingual intake
    form actually generates.
    """
    return _substitute(text, ENGLISH_LABELS)
