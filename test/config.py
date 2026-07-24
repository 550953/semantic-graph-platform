"""
🐝 Test Suite Configuration
"""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class TestConfig:
    
    # Server
    base_url: str = "http://localhost:3001"
    api_prefix: str = "/api"
    
    # Auth credentials
    test_email: str = "admin@graph.local"
    test_password: str = "admin123"
    
    # Test options
    quick_mode: bool = False
    verbose: bool = False
    report_path: Optional[str] = None
    
    # Timeouts (seconds)
    request_timeout: int = 30
    ai_timeout: int = 60
    
    # Rate limiting
    rate_limit_requests: int = 15
    
    # Colors
    use_colors: bool = True
    
    @property
    def api_url(self) -> str:
        return f"{self.base_url}{self.api_prefix}"
    
    @classmethod
    def from_args(cls, args):
        """Create config from CLI args"""
        return cls(
            base_url=args.url or cls.base_url,
            test_email=args.email or cls.test_email,
            test_password=args.password or cls.test_password,
            quick_mode=args.quick or False,
            verbose=args.verbose or False,
            report_path=args.report or None,
        )


# Global config instance
config = TestConfig()

# Legacy constants (backward compatibility)
BASE_URL = config.base_url
API_PREFIX = config.api_prefix
TEST_USER = config.test_email
TEST_PASS = config.test_password