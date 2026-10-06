import pytest
from app.services.conversation import ConversationStore


def test_create_conversation():
    store = ConversationStore()
    conv = store.create()
    assert conv.id
    assert conv.title == "New Chat"
    assert len(conv.messages) == 0


def test_add_message():
    store = ConversationStore()
    conv = store.create()
    msg = store.add_message(conv.id, "user", "Hello")
    assert msg.role == "user"
    assert msg.content == "Hello"
    assert len(conv.messages) == 1


def test_first_user_message_sets_title():
    store = ConversationStore()
    conv = store.create()
    store.add_message(conv.id, "user", "What is binary search?")
    assert conv.title == "What is binary search?"


def test_get_recent_messages():
    store = ConversationStore()
    conv = store.create()
    store.add_message(conv.id, "user", "Hello")
    store.add_message(conv.id, "assistant", "Hi there!")
    recent = store.get_recent_messages(conv.id)
    assert len(recent) == 2
    assert recent[0]["role"] == "user"
    assert recent[1]["role"] == "assistant"


def test_get_recent_messages_limit():
    store = ConversationStore()
    conv = store.create()
    for i in range(30):
        store.add_message(conv.id, "user", f"Message {i}")
    recent = store.get_recent_messages(conv.id, limit=5)
    assert len(recent) == 5


def test_list_conversations():
    store = ConversationStore()
    store.create()
    store.create()
    convs = store.list_conversations()
    assert len(convs) == 2


def test_delete_conversation():
    store = ConversationStore()
    conv = store.create()
    assert store.delete(conv.id) is True
    assert store.get(conv.id) is None
    assert store.delete("nonexistent") is False


def test_get_or_create_existing():
    store = ConversationStore()
    conv = store.create()
    same = store.get_or_create(conv.id)
    assert same.id == conv.id


def test_get_or_create_new():
    store = ConversationStore()
    conv = store.get_or_create(None)
    assert conv.id
    assert store.get(conv.id) is not None


def test_add_message_nonexistent_conv():
    store = ConversationStore()
    with pytest.raises(ValueError):
        store.add_message("nonexistent", "user", "Hello")
