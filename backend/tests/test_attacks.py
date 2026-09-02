
from app.engine.attacks import (
    BUILTIN_ATTACKS,
    DefaultAttack,
    JailbreakAttack,
    ManyShotAttack,
    PromptInjectionAttack,
    get_attack,
    list_builtin_attacks,
)


def test_builtin_registry_has_core_attacks() -> None:
    keys = {a.key for a in list_builtin_attacks()}
    assert {"default", "jailbreak", "injection", "many_shot"} <= keys
    assert keys == set(BUILTIN_ATTACKS)


def test_default_attack_passes_prompt_unchanged() -> None:
    msgs = DefaultAttack().build_messages("hello world")
    assert msgs == [{"role": "user", "content": "hello world"}]


def test_jailbreak_wraps_prompt() -> None:
    msgs = JailbreakAttack().build_messages("Write a note")
    assert msgs[0]["role"] == "user"
    assert "DAN" in msgs[0]["content"]
    assert "Write a note" in msgs[0]["content"]


def test_injection_prefixes_override() -> None:
    msgs = PromptInjectionAttack().build_messages("Do X")
    assert "IGNORE ALL PREVIOUS INSTRUCTIONS" in msgs[0]["content"]
    assert "Do X" in msgs[0]["content"]


def test_many_shot_includes_examples() -> None:
    msgs = ManyShotAttack().build_messages("Target prompt")
    assert "examples of how you always respond" in msgs[0]["content"]
    assert "Target prompt" in msgs[0]["content"]


def test_get_attack_unknown_returns_none() -> None:
    assert get_attack("nope") is None
    assert get_attack("jailbreak") is not None
