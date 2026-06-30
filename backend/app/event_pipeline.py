"""Utilitários de redução visual da timeline (não fazem parte do spm-preprocessing)."""


def first_occurrence_per_class(events: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for ev in events:
        base = ev["event"].split("_SOME")[0].split("_MANY")[0]
        if base not in seen:
            seen.add(base)
            out.append(ev)
    return out


def declutter_events(events: list[dict], mode: str = "first_class") -> list[dict]:
    if mode == "first_class":
        return first_occurrence_per_class(events)
    return events
