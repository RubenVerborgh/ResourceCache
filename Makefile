test:
	@./node_modules/.bin/vows

jshint:
	@jshint lib

.PHONY: test jshint
