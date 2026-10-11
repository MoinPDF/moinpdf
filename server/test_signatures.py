import unittest
from server.signature_fixture import signature_fixture
from server.signature_documents import sign_bytes,validate_bytes,renew_bytes

class SignatureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.fixture=signature_fixture()

    def test_strict_revocation_and_missing_evidence(self):
        f=self.fixture;signed=sign_bytes(f['plain'],f['signer'],'basic')
        valid=validate_bytes(signed,f['roots'],[f['crl']])['signatures'][0]
        self.assertTrue(valid['intact']);self.assertTrue(valid['cryptographicallyValid']);self.assertTrue(valid['trustedChain'])
        missing=validate_bytes(signed,f['roots'])['signatures'][0]
        self.assertFalse(missing['trustedChain']);self.assertIsNotNone(missing['trustProblem'])
        revoked=validate_bytes(signed,f['roots'],[f['revoked_crl']])['signatures'][0]
        self.assertTrue(revoked['revoked']);self.assertFalse(revoked['trustedChain'])

    def test_real_lta_includes_trusted_timestamp_and_offline_dss(self):
        f=self.fixture
        signed=sign_bytes(f['plain'],f['signer'],'lta',f['roots'],[f['crl']],timestamper=f['tsa'])
        report=validate_bytes(signed,f['roots'])
        signature=report['signatures'][0]
        self.assertTrue(signature['trustedChain'],'Embedded DSS provides actual revocation evidence')
        self.assertTrue(signature['signatureTimestamp']['trustedChain'])
        self.assertTrue(signature['signatureTimestamp']['intact'])
        self.assertEqual(signature['longTerm']['indication'],'AdESStatus.PASSED')
        self.assertEqual(report['documentTimestamps'],1)
        renewed=renew_bytes(signed,f['roots'],[f['crl']],[],f['tsa'])
        checked=validate_bytes(renewed,f['roots'])
        self.assertGreater(checked['documentTimestamps'],report['documentTimestamps'])
        self.assertEqual(checked['signatures'][0]['longTerm']['indication'],'AdESStatus.PASSED')

    def test_profiles_require_explicit_trust_and_tsa(self):
        f=self.fixture
        with self.assertRaisesRegex(ValueError,'benötigen'):sign_bytes(f['plain'],f['signer'],'lta')
        with self.assertRaisesRegex(ValueError,'Unbekanntes'):sign_bytes(f['plain'],f['signer'],'fake')
        with self.assertRaisesRegex(ValueError,'vorhandene'):renew_bytes(f['plain'],f['roots'],[f['crl']],[],f['tsa'])

if __name__=='__main__':unittest.main()
