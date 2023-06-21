class Output {
    constructor({ type, data, fn }) {
        this.type = type;
        this.data = data;
        this.fn = fn;
    }

    assign({ ui }) {
        this.ui = ui;
    }

    execute() {
        this.ui.emitOutput(
            this.fn({
                dataStore: this.ui.getDataStore(),
                type: this.type,
                data: this.data,
            })
        );
    }
}

class Expectation {
    constructor({ type, data, fn }) {
        this.type = type; // "text" or "MCQ"
        this.data = data; // any relevant information that UI needs to create input UI like max 100 characters or one among "A", "B", "C" etc
        this.fn = fn; // dynamic function using which actual type and data can be modified.
    }

    assign({ ui }) {
        this.ui = ui;
    }

    execute() {
        this.ui.emitExpectation(
            this.fn({
                dataStore: this.ui.getDataStore(),
                type: this.type,
                data: this.data,
            })
        );
    }
}

class Node {
    constructor({ output, expectation, decisionMaker }) {
        this.output = output;
        this.expectation = expectation;
        this.decisionMaker = decisionMaker;
    }

    assign({ ui }) {
        this.ui = ui;
        if (this.output) {
            this.output.assign({ ui });
        }
        if (this.expectation) {
            this.expectation.assign({ ui });
        }
    }

    execute() {
        if (this.output) {
            this.output.execute();
        }
        if (this.expectation) {
            this.expectation.execute();
        }
        // If this is a node which just presents information to user
        // we don't need to wait for user's input. There is nothing to wait for.
        if (!this.expectation) {
            this.onInput({ input: null });
        }
    }

    // process user's input
    onInput({ input }) {
        const { nextNode, miniDataStore } = this.decisionMaker({
            input,
            dataStore: this.ui.getDataStore(),
        });

        if (miniDataStore) {
            this.ui.mergeMiniDataStore({
                miniDataStore,
            });
        }

        if (nextNode) {
            this.ui.moveToNextNode(nextNode);
        } else {
            this.ui.endSession();
        }
    }
}

class Manager extends Node {
    constructor({ nodeMap, rootNode, decisionMaker, frontend }) {
        super({ output: null, expectation: null, decisionMaker });
        this.nodeMap = nodeMap;
        this.rootNode = rootNode;
        this.currentNode = rootNode;
        this.frontend = frontend;
    }

    // new helper
    isRootUI() {
        return !this.ui;
    }

    getNodeFromName(name) {
        return this.nodeMap[name];
    }

    emitOutput({ type, data }) {
        if (this.isRootUI()) {
            this.frontend.showOutputToUser({
                type,
                data,
            });
        } else {
            this.ui.emitOutput({
                type,
                data,
            });
        }
    }

    assign({ ui, dataStore }) {
        if (ui) {
            this.ui = ui;
        }
        if (dataStore) {
            this.dataStore = dataStore;
        }
        this.getNodeFromName(this.currentNode).assign({ ui: this });
    }

    emitExpectation({ type, data }) {
        if (this.isRootUI()) {
            this.frontend.getInputFromUser({
                type,
                data,
            });
        } else {
            this.ui.emitExpectation({
                type,
                data,
            });
        }
    }

    execute() {
        this.getNodeFromName(this.currentNode).execute();
    }

    mergeMiniDataStore({ miniDataStore }) {
        if (this.isRootUI()) {
            this.dataStore = Object.assign({}, this.dataStore, miniDataStore);
        } else {
            this.ui.mergeMiniDataStore({ miniDataStore });
        }
    }

    getDataStore() {
        if (this.isRootUI()) {
            return this.dataStore;
        }
        return this.ui.getDataStore();
    }

    moveToNextNode(node) {
        this.currentNode = node;
        this.getNodeFromName(this.currentNode).assign({ ui: this });
        this.execute();
    }

    onInput({ input }) {
        this.getNodeFromName(this.currentNode).onInput({ input });
    }

    endSession() {
        const { nextNode, miniDataStore } = this.decisionMaker({
            dataStore: this.getDataStore(),
        });

        if (miniDataStore) {
            this.mergeMiniDataStore({
                miniDataStore,
            });
        }

        if (nextNode) {
            this.currentNode = this.rootNode;
            this.ui.moveToNextNode(nextNode);
        } else if (this.isRootUI()) {
            this.frontend.endUserSession();
        } else {
            this.currentNode = this.rootNode;
            this.ui.endSession();
        }
    }
}

var nodeMap = {};

/*
The flow we will build out will look like this:

Start session

Respond: “What is your name?”

Accept: text from user

Respond: “Hello! <user name>”

Respond: “What are you comfortable with?”

Accept: One of “Java” or “JavaScript”

Respond: “Sweet.”

Respond: “What is 1 + 2 in Java?” (if previous response is “Java”)

Accept: text

Respond: “Correct!” or “You are higher” or “You are lower” depending on user’s input

Accept: text if previous attempt is not correct and if it is < 3 attempts.

Respond: “What is 1 + 2 in JavaScript?” (if previous response is “JavaScript”)

Rest of the flow remains same as Java

Respond: “That’s it from my end. Hope you liked the chat <user name>”

End session

*/

var askNameNode;
var respondNameNode;

var askNameManager;

var languageQuestionsNode;
var languageQuestionsResponseNode;
var javaQuestionNode;
var javaQuestionResponseNode;
var javaScriptQuestionNode;
var javaScriptQuestionResponseNode;

var languageQuestionsManager;

var endNode;

var askNameNode = new Node({
    output: new Output({
        type: "text",
        data: "What is your name?",
        fn: ({ dataStore, type, data }) => {
            return {
                type,
                data,
            };
        },
    }),
    expectation: new Expectation({
        type: "text",
        data: {
            max: 100,
        },
        fn: ({ dataStore, type, data }) => {
            return {
                type,
                data,
            };
        },
    }),
    decisionMaker: ({ input, dataStore }) => {
        return {
            nextNode: "respondNameNode",
            miniDataStore: {
                name: input,
            },
        };
    },
});

var respondNameNode = new Node({
    output: new Output({
        type: "text",
        data: "Hello! ${name}",
        fn: ({ dataStore, type, data }) => {
            return {
                type,
                data: data.replace("${name}", dataStore.name),
            };
        },
    }),
    expectation: null,
    decisionMaker: ({ input, dataStore }) => {
        return {
            miniDataStore: null,
        };
    },
});

var askNameManager = new Manager({
    nodeMap: {
        askNameNode,
        respondNameNode,
    },
    rootNode: "askNameNode",
    decisionMaker: ({ dataStore }) => {
        return {
            nextNode: "languageQuestionsManager",
            miniDataStore: null,
        };
    },
});

var languageQuestionsNode = new Node({
    output: new Output({
        type: "text",
        data: "What are you comfortable with?",
        fn: ({ dataStore, type, data }) => {
            return {
                type,
                data,
            };
        },
    }),
    expectation: new Expectation({
        type: "mcq",
        data: {
            options: ["Java", "JavaScript"],
        },
        fn: ({ dataStore, type, data }) => {
            return {
                type,
                data,
            };
        },
    }),
    decisionMaker: ({ input, dataStore }) => {
        return {
            nextNode: "languageQuestionsResponseNode",
            miniDataStore: {
                language: input,
            },
        };
    },
});

var languageQuestionsResponseNode = new Node({
    output: new Output({
        type: "text",
        data: "Sweet.",
        fn: ({ dataStore, type, data }) => {
            return {
                type,
                data,
            };
        },
    }),
    expectation: null,
    decisionMaker: ({ input, dataStore }) => {
        return {
            nextNode:
                dataStore.language === "Java"
                    ? "javaQuestionNode"
                    : "javaScriptQuestionNode",
            miniDataStore: null,
        };
    },
});

var javaQuestionNode = new Node({
    output: new Output({
        type: "text",
        data: "What is 1 + 2 in Java?",
        fn: ({ dataStore, type, data }) => {
            if (dataStore.attempts >= 1) {
                return {};
            }

            return {
                type,
                data,
            };
        },
    }),
    expectation: new Expectation({
        type: "text",
        data: {
            max: 100,
        },
        fn: ({ dataStore, type, data }) => {
            return {
                type,
                data,
            };
        },
    }),
    decisionMaker: ({ input, dataStore }) => {
        return {
            nextNode: "javaQuestionResponseNode",
            miniDataStore: {
                answer: input,
                attempts: (dataStore.attempts || 0) + 1,
            },
        };
    },
});

var javaQuestionResponseNode = new Node({
    output: new Output({
        type: "text",
        data: null,
        fn: ({ dataStore, type, data }) => {
            if (Number(dataStore.answer) === 3) {
                return {
                    type,
                    data: "Correct!",
                };
            } else if (dataStore.attempts === 3) {
                return {
                    type,
                    data: "Noted. You are out of attempts.",
                };
            } else if (Number(dataStore.answer) < 3) {
                return {
                    type,
                    data: "You are lower",
                };
            } else {
                return {
                    type,
                    data: "You are higher",
                };
            }
        },
    }),
    expectation: null,
    decisionMaker: ({ input, dataStore }) => {
        if (Number(dataStore.answer) === 3 || dataStore.attempts >= 3) {
            return {
                nextNode: null,
                miniDataStore: null,
            };
        } else {
            return {
                nextNode: "javaQuestionNode",
                miniDataStore: null,
            };
        }
    },
});

var javaScriptQuestionNode = new Node({
    output: new Output({
        type: "text",
        data: "What is 1 + 2 in JavaScript?",
        fn: ({ dataStore, type, data }) => {
            if (dataStore.attempts >= 1) {
                return {};
            }

            return {
                type,
                data,
            };
        },
    }),
    expectation: new Expectation({
        type: "text",
        data: {
            max: 100,
        },
        fn: ({ dataStore, type, data }) => {
            return {
                type,
                data,
            };
        },
    }),
    decisionMaker: ({ input, dataStore }) => {
        return {
            nextNode: "javaScriptQuestionResponseNode",
            miniDataStore: {
                answer: input,
                attempts: (dataStore.attempts || 0) + 1,
            },
        };
    },
});

var javaScriptQuestionResponseNode = new Node({
    output: new Output({
        type: "text",
        data: null,
        fn: ({ dataStore, type, data }) => {
            if (Number(dataStore.answer) === 3) {
                return {
                    type,
                    data: "Correct!",
                };
            } else if (dataStore.attempts === 3) {
                return {
                    type,
                    data: "Noted. You are out of attempts.",
                };
            } else if (Number(dataStore.answer) < 3) {
                return {
                    type,
                    data: "You are lower",
                };
            } else {
                return {
                    type,
                    data: "You are higher",
                };
            }
        },
    }),
    expectation: null,
    decisionMaker: ({ input, dataStore }) => {
        if (Number(dataStore.answer) === 3 || dataStore.attempts >= 3) {
            return {
                nextNode: null,
                miniDataStore: null,
            };
        } else {
            return {
                nextNode: "javaScriptQuestionNode",
                miniDataStore: null,
            };
        }
    },
});

var languageQuestionsManager = new Manager({
    nodeMap: {
        languageQuestionsNode,
        languageQuestionsResponseNode,
        javaQuestionNode,
        javaQuestionResponseNode,
        javaScriptQuestionNode,
        javaScriptQuestionResponseNode,
    },
    rootNode: "languageQuestionsNode",
    decisionMaker: ({ dataStore }) => {
        return {
            nextNode: "endNodeManager",
            miniDataStore: null,
        };
    },
});

var endNode = new Node({
    output: new Output({
        type: "text",
        data: "That’s it from my end. Hope you liked the chat ${name}",
        fn: ({ dataStore, type, data }) => {
            return {
                type,
                data: data.replace("${name}", dataStore.name),
            };
        },
    }),
    expectation: null,
    decisionMaker: ({ input, dataStore }) => {
        return {
            nextNode: null,
            miniDataStore: null,
        };
    },
});

var endNodeManager = new Manager({
    nodeMap: {
        endNode,
    },
    rootNode: "endNode",
    decisionMaker: ({ dataStore }) => {
        return {
            nextNode: null,
            miniDataStore: null,
        };
    },
});

var rootManager = new Manager({
    nodeMap: {
        askNameManager,
        languageQuestionsManager,
        endNodeManager,
    },
    rootNode: "askNameManager",
    decisionMaker: ({ dataStore }) => {
        return {
            nextNode: null,
            miniDataStore: null,
        };
    },
    frontend: {}, // this will be replaced with actual frontend handle
});
