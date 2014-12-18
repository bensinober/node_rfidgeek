REPORTER = spec

test:
	@NODE_ENV=test mocha \
		--reporter $(REPORTER) \

test-w:
	@NODE_ENV=test mocha \
		--reporter $(REPORTER) \
		--growl \
		--watch

cover:
	@NODE_ENV=test istanbul cover \
		node_modules/.bin/_mocha -- -- -u exports \
		--reporter $(REPORTER) test/*

todo:
	@grep -rn TODO rfid.js ./lib/*.js || true

.PHONY: test test-w
