import json
import socket
import subprocess
import sys
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        cls.base = f'http://127.0.0.1:{port}'
        cls.server = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', str(port)],
            cwd=Path(__file__).parent, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        for _ in range(100):
            try:
                cls.call('/api/health')
                return
            except (URLError, TimeoutError):
                if cls.server.poll() is not None:
                    break
                time.sleep(0.1)
        cls.server.terminate()
        cls.server.wait(timeout=5)
        raise RuntimeError('API did not start')

    @classmethod
    def tearDownClass(cls):
        cls.server.terminate()
        cls.server.wait(timeout=5)

    @classmethod
    def call(cls, path, payload=None):
        request = Request(cls.base + path, data=None if payload is None else json.dumps(payload).encode(),
                          headers={'Content-Type': 'application/json'})
        try:
            response = urlopen(request, timeout=5)
        except HTTPError as exc:
            response = exc
        with response:
            return response.status, json.loads(response.read())

    def test_health(self):
        self.assertEqual(self.call('/api/health'), (200, {'status': 'ok'}))

    def test_format_and_validate(self):
        status, result = self.call('/api/format', {'text': '{"a":[1,true,null]}', 'indent': 4})
        self.assertEqual(status, 200)
        self.assertEqual(result['formatted'], '{\n    "a": [\n        1,\n        true,\n        null\n    ]\n}')
        self.assertTrue(self.call('/api/validate', {'text': result['formatted']})[1]['valid'])

    def test_invalid_location(self):
        result = self.call('/api/validate', {'text': '{\n"a":}'})[1]
        self.assertFalse(result['valid'])
        self.assertEqual(result['error']['line'], 2)
        self.assertEqual(result['error']['column'], 5)
        self.assertEqual(self.call('/api/format', {'text': '{'})[0], 400)

    def test_primitives_unicode_and_large_integer(self):
        for text in ['null', 'true', '42', '"한글"', '9007199254740993', '"\\ud800"']:
            status, result = self.call('/api/format', {'text': text})
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(result['formatted']), json.loads(text))

    def test_limits_and_non_json_constants(self):
        for text in ['', 'NaN', 'Infinity', '1e9999', '[' * 102 + '0' + ']' * 102]:
            self.assertFalse(self.call('/api/validate', {'text': text})[1]['valid'])
        self.assertEqual(self.call('/api/format', {'text': '{}', 'indent': 0})[0], 422)
        self.assertEqual(self.call('/api/validate', {'text': ' ' * 1_000_001})[0], 422)


if __name__ == '__main__':
    unittest.main()
