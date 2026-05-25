from caspi.infrastructure.crypto import decrypt, encrypt


def test_roundtrip():
    cipher = encrypt("hello-secret")
    assert isinstance(cipher, (bytes, memoryview, bytearray)) or isinstance(cipher, str)
    assert decrypt(cipher) == "hello-secret"


def test_different_ciphertexts_for_same_plaintext():
    a = encrypt("same")
    b = encrypt("same")
    assert a != b
    assert decrypt(a) == decrypt(b) == "same"
