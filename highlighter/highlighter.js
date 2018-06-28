function HighlighterPlus() {

    let $ = window.jQuery = jQuery.noConflict(true);

    let _ = this;
    let _ui = null;
    let _nodeHunter = new NodeHunter();

    let _observer = new CachedMutationObserver();
    _observer.onObservation = processElement;


    let _highlighting = false;
    let _clearingHighlights = false;
    this.enabled = true;

    this.categoryCollection = new HighlighterCategoryCollection();
    this.wordCollection = new HighlighterWordCollection(_.categoryCollection);
    _.wordCollection.onChange = async function (cats) {
        if(_ui !== null){
            _ui.updateWords(cats);
        }
        await reHighlight();
    };
    _.categoryCollection.load();
    _.categoryCollection.onChange = async function (cats) {
        if(_ui !== null){
            _ui.updateCategories(cats);
        }
        await reHighlight();
    };
    _.wordCollection.load();

    let _replacementProvider = new TextReplacementProvider(_.wordCollection.get());

    this.attachUI = function (ui) {
        if (ui.constructor.name === 'UI') {
            _ui = ui;
            _ui.updateWords(_.wordCollection.get());
            _ui.updateCategories(_.categoryCollection.get());
            window.document.body.insertBefore(_ui.element, document.body.childNodes[0]);
            return;
        }
        _ui = null;
    };

    //region Console Commands
    this.bruteForce ={
        bruteForceInterval:null,
        enabled:false,
        interval:30000,
        start:function () {
            if(_.bruteForce.bruteForceInterval === null){
                _.bruteForce.bruteForceInterval = setInterval(() => {
                    highlightWords();
                },_.bruteForce.interval);
                _observer.stop();
            }
        },
        stop:function () {
            if(_.bruteForce.bruteForceInterval !== null){
                clearInterval(_.bruteForce.bruteForceInterval);
                _.bruteForce.bruteForceInterval = null;
                _observer.start();
            }
        }
    };
    this.highlight = highlightAll;
    this.reHighlight = reHighlight;
    this.clearHighlights = clearWordHighlights;
    this.enable = () => {
        _observer.enabled = true;
    };
    this.disable = () => {
        _observer.enabled = false;
    };
    this.enableThreading = _replacementProvider.enableThreading;
    this.disableThreading = _replacementProvider.disableThreading;
    //endregion

    function isMenuItem(ele) {
        if(!_.enabled){return;}
        let highlighterButtonContainer = document.getElementById('highlighter-button-container');
        if(highlighterButtonContainer){
            return document.getElementById('highlighter-button-container').contains(ele) || _ui.element.contains(ele);
        }
        return _ui.element.contains(ele);
    }

    async function processElement(ele) {
        if (isMenuItem(ele)) {return;}
        await highlightElementButtons(ele);
        await highlightElementTextNodes(ele);
    }

    async function highlightElementTextNodes(ele) {
        let textNodes = _nodeHunter.textNodesUnder(ele);
        for(let textNode of textNodes){
            if (!isMenuItem(textNode)){
                if(_replacementProvider.isThreaded()){
                    await replaceWordsAsync(textNode);
                }
                else {
                    replaceWords(textNode);
                }
            }
        }
    }

    async function highlightElementButtons(ele) {
        let buttonNodes = _nodeHunter.inputButtonNodesUnder(ele);
        for(let buttonNode of buttonNodes){
            if (!isMenuItem(ele)) {
                buttonNode = convertInputButtonToButton(buttonNode);
                await highlightElementTextNodes(ele);
            }
        }
    }

    async function highlightAll() {
        if(_highlighting || _clearingHighlights){return;}
        _highlighting = true;
        console.time('highlightTime');
        await highlightButtons();
        await highlightWords();
        console.timeEnd('highlightTime');
        _highlighting = false;
    }

    async function reHighlight() {
        if(_highlighting || _clearingHighlights){return;}
        _highlighting = true;
        clearWordHighlights();
        console.time('highlightTime');
        await highlightButtons();
        await highlightWords();
        console.timeEnd('highlightTime');
        _highlighting = false;
    }

    async function highlightWords() {
        console.time('highlightWords');
        let threadTasks = [];
        let targetElements = _nodeHunter.textNodesUnder(document.body);
        if (targetElements.length === 0) {return;}
        for (let i = 0; i < targetElements.length; i++) {
            let element = targetElements[i];
            if (isMenuItem(targetElements[i])){continue;}
            if(_replacementProvider.isThreaded()){
                threadTasks.push(replaceWordsAsync(element))
            }
            else{
                replaceWords(element);
            }
        }
        if(threadTasks.length > 0){
            await Promise.all(threadTasks);
        }
        console.timeEnd('highlightWords');
    }
    async function highlightButtons() {
        console.time('highlightingButtons');
        let targetElements = document.querySelectorAll('input[type="button"]:not([hidden="true"]):not([style="display:none;"])');
        if (targetElements.length > 0) {
            for (let i = 0; i < targetElements.length; i++) {
                let element = targetElements[i];
                if (isMenuItem(element)) {
                    continue;
                }
                element = convertInputButtonToButton(element);
                if(_replacementProvider.isThreaded()){
                    await replaceWordsAsync(element);
                }
                else{
                    replaceWords(element);
                }
            }
        }
        else {
            targetElements = document.querySelectorAll('button[class="highlighter-button"]');
            if (targetElements.length > 0) {
                for (let i = 0; i < targetElements.length; i++) {
                    let element = targetElements[i];
                    await highlightElementTextNodes(element);
                }
            }
        }
        console.timeEnd('highlightingButtons');
    }

    function clearWordHighlights() {
        if(_clearingHighlights){return;}
        _clearingHighlights = true;
        let marks = _nodeHunter.taggedNodesUnder(document.body, 'mark');
        for(let mark of marks) {
            mark.outerHTML = mark.innerHTML;
        }
        document.body.normalize();
        _clearingHighlights = false;
    }

    function replaceWords(node) {
        if(node.parentNode) {
            let text = node.textContent;
            if (text === '') {return;}
            let newContent = _replacementProvider.tagAllWordsInString(text);
            if (newContent !== text) {
                if(node.parentNode){
                    let newElement = document.createElement('template');
                    newElement.innerHTML = newContent;
                    node.parentNode.replaceChild(newElement.content, node);
                }
            }
        }
    }
    async function replaceWordsAsync(node) {
        if(node.parentNode) {
            let text = node.textContent;
            if (text === '') {
                return;
            }
            let newContent = await _replacementProvider.tagAllWordsInString(text);
            if (newContent !== text) {
                if(node.parentNode){
                    let newElement = document.createElement('template');
                    newElement.innerHTML = newContent;
                    node.parentNode.replaceChild(newElement.content, node);
                }
            }
        }
    }

    function convertInputButtonToButton(element) {
        let originalElement = element
            , originalTag = originalElement.tagName
            , startRX = new RegExp('^<'+originalTag, 'i')
            , endRX = new RegExp(originalTag+'>$', 'i')
            , startSubst = '<button'
            , endSubst = 'button>'
            , newHTML = originalElement.outerHTML
            .replace(startRX, startSubst)
            .replace(endRX, endSubst);
        let newElement = document.createElement('div');
        newElement.innerHTML = newHTML;
        newElement = newElement.childNodes[0];
        newElement.innerHTML = element.value;
        originalElement.parentNode.replaceChild(newElement, originalElement);
        return newElement;
    }
    function makeRegexFromString(string) {
        try {
            if (string[0] === '/') {
                string = string.substr(1);
            }
            let flags = string.replace(/.*\/([gimy]*)$/, '$1');
            let pattern = string.replace(new RegExp('^/(.*?)/' + flags + '$'), '$1');
            pattern = pattern.substr(0, pattern.length - flags.length - 1);
            return new RegExp(pattern, flags);
        }
        catch (e) {
            return "";
        }
    }
    function showMessage(message, isError) {
        if (_ui !== null) {
            _ui.showMessage(message, isError);
        }
        else {
            let preText = 'Chat Highlighter:';
            if (isError) {
                console.error(`${preText} ${message}`);
            }
            else {
                console.log(`${preText} ${message}`);
            }
        }
    }

    function NodeHunter() {

        //Async is for read-only type operations

        this.textNodesUnder = function(ele){

            let nodeIterator = document.createNodeIterator(ele, NodeFilter.SHOW_TEXT,{ acceptNode: filterResult }, false);

            let nodes = [];
            let node = null;
            let lastNode = null;
            while ((node = nodeIterator.nextNode())) {
                if(node.parentNode){
                    if(node.parentNode.tagName === 'SCRIPT'){continue;}
                    if(node.parentNode.tagName === 'MARK'){continue;}
                    if(node.parentNode.className === 'highlighter-processed-element'){continue;}
                    if(node.parentNode.tagName === 'STYLE'){continue;}
                }
                if(node.isEqualNode(lastNode)){continue;}
                //lastNode = node;
                nodes.push(node);
            }
            return nodes;

            function filterResult(node){
                if ( ! /^\s*$/.test(node.data) ) {
                    return NodeFilter.FILTER_ACCEPT;
                }
            }

        };
        this.textNodesUnderAsync = function*(ele){
            let nodeIterator = document.createNodeIterator(ele, NodeFilter.SHOW_TEXT,{ acceptNode: filterResult }, false);

            let node = null;
            let lastNode = null;
            while ((node = nodeIterator.nextNode())) {
                if(node.isEqualNode(lastNode)){continue;}
                lastNode = node;
                yield node;
            }

            function filterResult(node){
                if ( ! /^\s*$/.test(node.data) ) {
                    console.log(node);
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        };

        this.inputButtonNodesUnder = function (ele) {

            let nodeIterator = document.createNodeIterator(ele, NodeFilter.SHOW_ELEMENT,{ acceptNode: filterResult }, false);

            let nodes = [];
            let node;
            while ((node = nodeIterator.nextNode())) {
                nodes.push(node);
            }

            function filterResult(node){
                if(node.tagName === 'INPUT' && node.type === 'button'){
                    if(isVisible(node)){
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            }

            return nodes;
        };
        function isVisible(e) {
            return !!( e.offsetWidth || e.offsetHeight || e.getClientRects().length );
        }
        this.inputButtonNodesUnderAsync = function*(ele) {
            let nodeIterator = document.createNodeIterator(ele, NodeFilter.SHOW_ELEMENT,{ acceptNode: filterResult }, false);

            let node;
            while ((node = nodeIterator.nextNode())) {
                yield node;
            }

            function filterResult(node){
                if(node.tagName === 'INPUT' && node.type === 'button'){
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        };

        this.taggedNodesUnder = function (ele, tag) {
            let nodeIterator = document.createTreeWalker(ele, NodeFilter.SHOW_ELEMENT,{ acceptNode: filterResult }, false);

            let nodes = [];
            let node;
            while ((node = nodeIterator.nextNode())) {
                nodes.push(node);
            }

            function filterResult(node){
                if(node.tagName === tag.toUpperCase()){
                    return NodeFilter.FILTER_ACCEPT;
                }
            }

            return nodes;
        };

        this.convertedButtonNodesUnder = function (ele) {
            let nodeIterator = document.createNodeIterator(ele, NodeFilter.SHOW_ELEMENT,{ acceptNode: filterResult }, false);

            let nodes = [];
            let node;
            while ((node = nodeIterator.nextNode())) {
                nodes.push(node);
            }

            function filterResult(node){
                if(node.tagName === 'INPUT' && node.type === 'button'){
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
            return nodes;
        };
        this.convertedButtonNodesUnderAsync = function*(ele) {
            let nodeIterator = document.createNodeIterator(ele, NodeFilter.SHOW_ELEMENT,{ acceptNode: filterResult }, false);

            let node;
            while ((node = nodeIterator.nextNode())) {
                yield node;
            }

            function filterResult(node){
                if(node.tagName === 'INPUT' && node.type === 'button'){
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        };

    }
    function CachedMutationObserver() {

        let _ = this;
        let _cache = [];
        let _isObserving = false;

        this.enabled = true;

        let observer = new MutationObserver(function (list) {
            if(!_.enabled){return;}
            if (_clearingHighlights || _highlighting) {return;}
            //console.log('v----Processing Mutations');
            //console.time('^----Processed Mutations');
            for (let mutation of list) {
                if(mutation.addedNodes.length > 0){
                    for (let node of mutation.addedNodes){
                        let cachedElement = _cache.find(function (ele) {
                            if(node.tagName){
                                if(node.tagName === 'MARK'){
                                    //   console.warn('|-->Ignoring Mark!');
                                    return true;
                                }
                                if(node.tagName === 'NOSCRIPT'){
                                    //   console.warn('|-->Ignoring NoScript!');
                                    return true;
                                }
                                if(node.tagName === 'NOBR'){
                                    //   console.warn('|-->Ignoring NOBR!');
                                    return true;
                                }
                                if(node.tagName === 'CITE'){
                                    //   console.warn('|-->Ignoring Cite!');
                                    return true;
                                }
                            }
                            if(node.className){
                                if(node.className === 'highlighter-button-element'){
                                    //     console.warn('|-->Ignoring Highlighter Button!');
                                    return true;
                                }
                            }
                            if(node.id){
                                if(node.id === ele.id){
                                    //        console.error(`Ignored Mutation ID [${ele.id}] - Updating too fast`);
                                    return true;
                                }
                            }
                            let cacheHit = ele.isEqualNode(mutation.target);
                            if(cacheHit){
                                //      console.warn('|-->Mutation Cache Hit!');
                            }
                            return cacheHit;
                        });
                        if (cachedElement) {
                            //    console.timeEnd('| Processed Mutation');
                            continue;
                        }
                        _cache.push(node);
                        setTimeout(() => {
                            onObservation(node);
                            //  console.timeEnd('| Processed Mutation');
                            setTimeout(function () {
                                _cache.pop();
                            }, 1000);
                        });
                    }
                }
                else{
                    //console.time('| Processed Mutation');
                }
            }
            //console.timeEnd('^----Processed Mutations');
        });

        this.start = function () {
            if (_isObserving) {return;}
            _isObserving = true;
            observer.observe(document.body, {subtree: true, childList: true});
        };
        this.stop = function stop() {
            if (_isObserving) {
                observer.disconnect();
                _isObserving = false;
            }
        };

        this.onObservation = null;

        async function onObservation(element) {
            if (_.onObservation !== null) {
                await _.onObservation(element);
            }
        }

    }
    function TextReplacementProvider(words){

        let _threading = false;
        let _replacer = new BasicReplacer(words);

        this.isThreaded = function () {
            return _threading;
        };

        this.updateWords = updateWords;
        this.enableThreading = enableThreading;
        this.disableThreading = disableThreading;
        this.tagAllWordsInString = tagAllWordsInString;

        function updateWords(words) {
            _replacer.updateWords(words);
        }
        function enableThreading() {
            if(_threading){return;}
            _replacer = new ThreadedReplacer(_wordCollection.get());
            _threading = true;
        }
        function disableThreading() {
            if(!_threading){return;}
            _replacer = new BasicReplacer(_wordCollection.get());
            _threading = false;
        }
        function tagAllWordsInString(string) {
            return _replacer.tagAllWordsInString(string);
        }

        function BasicReplacer(words) {
            let _ = this;
            let _words = words || [];

            this.updateWords = updateWords;
            this.tagAllWordsInString = tagAllWordsInString;

            function updateWords(words) {
                _words = words;
                initWords();
            }
            function tagAllWordsInString(input) {
                if(_words.length < 1){return input;}
                let markRegex = new RegExp("<(mark)(\\b|\\s)(class|\\b)(.*?)>");
                let parts = splitMarks(input);
                for(word of _words) {
                    for (let i = 0; i < parts.length; i++) {
                        if (markRegex.test(parts[i])) {continue;}
                        if(word.expression.test(parts[i])) {
                            let newPart = parts[i].replace(word.expression, function (match) {
                                return `<mark class="${word.category.elementId}">${match}</mark>`
                            });
                            let marks = splitMarks(newPart);
                            parts.splice(i, 1, ...marks);
                        }
                    }
                }
                return parts.join('');
            }
            function tagAllWordsInString2(input) {
                if(_words.length < 1){return input;}
                let element = document.createElement('div');
                element.innerHTML = input;
                for(let word of _words){
                    let nodes = _nodeHunter.textNodesUnder(element);
                    for(let node of nodes){
                        let isModified = false;
                        let newContent = node.textContent.replace(new RegExp(word.expression, 'gmi'), function (match) {
                            isModified = true;
                            return `<mark class="${word.category.elementId}">${match}</mark>`;
                        });
                        if(isModified){
                            let replacementEle = document.createElement('template');
                            replacementEle.innerHTML = newContent;
                            node.parentNode.replaceChild(replacementEle.content, node);
                        }
                    }
                }
                return element.innerHTML;
            }
            function initWords() {
                sort();
                for(let word of _words){
                    if (word.regex) {
                        word.expression = makeRegexFromString(word.text);
                    }
                    else{
                        let _whole = `${word.wholeWord ? '\\b' : ''}`;
                        let _case = `${word.matchCase ? '' : 'i'}`;
                        word.expression = new RegExp(`${_whole}${word.text}${_whole}`, `g${_case}`);
                    }
                }
            }
            function sort() {
                _words.sort(function (a, b) {
                    let aVal = a.regex ? a.text.length - 150 : a.text.length;
                    let bVal = b.regex ? b.text.length - 150 : b.text.length;
                    return bVal - aVal;
                });
            }
            function splitMarks(text) {
                let parts = [];
                let markerStartIndex;
                let markerEndIndex;
                while ((markerStartIndex = text.indexOf('<mark')) > -1){
                    if(markerStartIndex > 0){parts.push(text.substring(0, markerStartIndex));}
                    markerEndIndex = text.indexOf('</mark>') + '</mark>'.length;
                    parts.push(text.substring(markerStartIndex, markerEndIndex));
                    text = text.substring(markerEndIndex);
                }
                if(text.length > -1){
                    parts.push(text);
                }
                return parts;
            }

        }
        function ThreadedReplacer(words) {

            let _ = this;
            let processorCount = window.navigator.hardwareConcurrency;

            this.onMessage = null;

            function createWorkerSystem() {

                return async function() {

                    let _ = this;
                    let _words = [];
                    initWords();

                    _.onmessage = handleMessage;

                    async function handleMessage(message) {
                        message = message.data;
                        if(message.command !== 'messageQueue'){
                            let promises = processMessageQueue([message]);
                            let promisedMessage = promises[0];
                            let results = await promisedMessage.promise(message.args);
                            await sendResult(promisedMessage.message, results);
                        }
                        else {
                            try {
                                let messagePromises = processMessageQueue(message.args);
                                for (let promisedMessage of messagePromises) {
                                    let result = await promisedMessage.promise(promisedMessage.message.args);
                                    storeResult(promisedMessage.message, result);
                                }
                                let completedMessages = messagePromises.map(p => p.message);
                                await sendResult(message, completedMessages);
                            }
                            catch(e){
                                console.log(e);
                            }
                        }
                    }

                    function processMessageQueue(messages) {
                        let promises = [];
                        for (let message of messages){
                            switch (message.command){
                                case 'processString':
                                    promises.push(new PromisedMessage(message, processString));
                                    break;
                                case 'processStrings':
                                    promises.push(new PromisedMessage(message, processStrings));
                                    break;
                                case 'updateWords':
                                    promises.push(new PromisedMessage(message, updateWords));
                            }
                        }
                        return promises;
                    }

                    async function updateWords(words) {
                        _words = words;
                        initWords();
                        return true;
                    }
                    async function processString(input){
                        return await tagAllWordsInString(input);
                    }
                    async function processStrings(strings) {
                        let results = [];
                        for(let string of strings){
                            results.push(await processString(string));
                        }
                        return results;
                    }

                    function storeResult(message, result){
                        message.result = result;
                    }
                    async function sendResult(message, result) {
                        storeResult(message, result);
                        _.postMessage(message);
                    }

                    function initWords() {
                        sortWords();
                        for(let word of _words){
                            if (word.regex) {
                                word.expression = makeRegexFromString(word.text);
                            }
                            else{
                                let _whole = `${word.wholeWord ? '\\b' : ''}`;
                                let _case = `${word.matchCase ? '' : 'i'}`;
                                word.expression = new RegExp(`${_whole}${word.text}${_whole}`, `g${_case}`);
                            }
                        }
                    }
                    function sortWords() {
                        _words.sort(function (a, b) {
                            let aVal = a.regex ? a.text.length - 150 : a.text.length;
                            let bVal = b.regex ? b.text.length - 150 : b.text.length;
                            return bVal - aVal;
                        });
                    }
                    function splitMarks(text) {
                        let parts = [];
                        let markerStartIndex;
                        let markerEndIndex;
                        while ((markerStartIndex = text.indexOf('<mark')) > -1){
                            if(markerStartIndex > 0){parts.push(text.substring(0, markerStartIndex));}
                            markerEndIndex = text.indexOf('</mark>') + '</mark>'.length;
                            parts.push(text.substring(markerStartIndex, markerEndIndex));
                            text = text.substring(markerEndIndex);
                        }
                        if(text.length > -1){
                            parts.push(text);
                        }
                        return parts;
                    }
                    function tagAllWordsInString(input) {
                        if(_words.length < 1){return input;}
                        let markRegex = new RegExp("<(mark)(\\b|\\s)(class|\\b)(.*?)>");
                        let parts = splitMarks(input);
                        for(word of _words) {
                            for (let i = 0; i < parts.length; i++) {
                                if (markRegex.test(parts[i])) {continue;}
                                if(word.expression.test(parts[i])) {
                                    let newPart = parts[i].replace(word.expression, function (match) {
                                        return `<mark class="${word.category.elementId}">${match}</mark>`
                                    });
                                    let marks = splitMarks(newPart);
                                    parts.splice(i, 1, ...marks);
                                }
                            }
                        }
                        return parts.join('');
                    }
                    function makeRegexFromString(string) {
                        try {
                            if (string[0] === '/') {
                                string = string.substr(1);
                            }
                            let flags = string.replace(/.*\/([gimy]*)$/, '$1');
                            let pattern = string.replace(new RegExp('^/(.*?)/' + flags + '$'), '$1');
                            pattern = pattern.substr(0, pattern.length - flags.length - 1);
                            return new RegExp(pattern, flags);
                        }
                        catch (e) {
                            return "";
                        }
                    }

                    function PromisedMessage(message, promise) {
                        this.message = message;
                        this.promise = promise;
                    }
                }
            }

            let workers = [];

            for(let i = 0; i < processorCount; i++){
                let worker = new Worker(URL.createObjectURL(new Blob(['(' + createWorkerSystem() + ')()'],{type: "application/javascript"})));
                worker.onmessage = sendMessageFromWorker;
                workers.push(worker);
            }

            updateWords(words);

            this.updateWords = updateWords;
            this.tagAllWordsInString = queueTagAllWordsInStrings;

            let queuedMessages = [];
            let messageResolvers = [];
            let currentQueueInterval = 0;
            let queueCheckInterval = null;
            function setQueueCheckInterval(ms) {
                if(queueCheckInterval) {
                    clearInterval(queueCheckInterval);
                }
                if(ms === null){
                    currentQueueInterval = null;
                    queueCheckInterval = null;
                    return;
                }
                currentQueueInterval = ms;
                queueCheckInterval = setInterval(processMessageQueue, ms);
            }

            let queueMisses = 0;
            async function processMessageQueue() {
                if(queuedMessages.length > 0){
                    let messages = queuedMessages.splice(0, queuedMessages.length);
                    queueMisses = 0;
                    let results = await pushMessageQueueToWorker(messages);
                    for(let chunk of results){
                        for(let message of chunk) {
                            message.onCompleted = messageResolvers[message.id];
                            message.onCompleted(message.result);
                            if (_.onMessage) {
                                _.onMessage(message.result);
                            }
                        }
                    }
                }
                else {
                    queueMisses++;
                    console.log('NO MESSAGES');
                    if(queueMisses >= 5){
                        setQueueCheckInterval(null);
                        console.log('CLEARED PUSH INTERVAL');
                    }
                }
            }

            function pushMessageQueueToWorker(messages) {
                return new Promise(async(resolve) => {
                    if(messages.length < 1){resolve(null);}
                    let messageChunks = chunkMessages(messages);
                    let promises = [];
                    let thread = 0;
                    for(let i = 0; i < messageChunks.length; i++){
                        if(thread >= processorCount){thread = 0;}
                        promises.push(new Promise((resolver) => {
                            sendMessageToWorker(new Message('messageQueue', messageChunks[i], resolver), thread);
                        }));
                        thread++;
                    }
                    let promisedResults = await Promise.all(promises);
                    resolve(promisedResults);
                });
            }

            function chunkMessages(messages) {

                let chunkedMessages = [];
                let chunkSize = Math.round(messages.length / navigator.hardwareConcurrency);
                let messagesChunked = 0;

                //console.log('CHUNKING');

                while (messagesChunked + chunkSize <= messages.length){
                    //console.log(`CHUNKS SIZE: ${chunkSize}`);
                    //console.log(`COMPLETED CHUNKS: ${messagesChunked}`);
                    //console.log(`MAX SIZE: ${messages.length}`);
                    chunkedMessages.push(messages.slice(messagesChunked, messagesChunked + chunkSize));
                    messagesChunked += chunkSize;
                }
                if(messagesChunked < messages.length){
                    let diff = messages.length - messagesChunked;
                    //console.log(`DIFF: ${diff}`);
                    chunkedMessages.push(messages.slice(messagesChunked, messages.length-1));
                }
                //console.log(`CHUNKS SIZE: ${chunkSize}`);
                //console.log(`CHUNKS READ: ${chunkedMessages.length}`);
                //console.log('CHUNKING FINISHED');

                return chunkedMessages;
            }

            function tagAllWordsInString(string){
                return new Promise((resolve) => {
                    sendMessageToWorker(new Message('processString', string, resolve));
                });
            }
            function queueTagAllWordsInStrings(string){
                return new Promise((resolve) => {
                    if(queueCheckInterval === null){setQueueCheckInterval(100);}
                    let message = new Message('processString', string, resolve);
                    messageResolvers[message.id] = message.onCompleted;
                    message.onCompleted = null;
                    queuedMessages.push(message);
                });
            }
            function updateWords(words) {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        for(let i = 0; i < workers.length; i++){
                            sendMessageToWorker(new Message('updateWords', words, resolve), i);
                        }
                    });
                });
            }

            let nextThread = 0;
            function sendMessageToWorker(message, thread) {
                try {
                    let threadIndex = nextThread;
                    if (threadIndex >= processorCount) {
                        threadIndex = 0;
                        nextThread = 0;
                    }
                    messageResolvers[message.id] = message.onCompleted;
                    message.onCompleted = null;
                    workers[thread || threadIndex].postMessage(message);
                    nextThread++;
                }
                catch (e){
                    console.log(e);
                }
            }
            function sendMessageFromWorker(message) {
                message = message.data;
                message.onCompleted = messageResolvers[message.id];
                message.onCompleted(message.result);
                if(_.onMessage){_.onMessage(message);}
            }

            let lastId = 0;
            function Message(command, args, onCompleted) {
                lastId++;
                this.id = lastId;
                this.command = command;
                this.args = args;
                this.result = null;
                this.onCompleted = function (data) {
                    onCompleted(data);
                };
            }
        }
    }


    function HighlighterCategoryCollection() {

        let _ = this;
        let _categories = [];

        this.get = get;
        this.load = load;
        this.add = add;
        this.update = update;
        this.remove = remove;
        this.getIndex = getIndex;

        function add(name, color, css) {
            if (_categories.find(x => x.name === name) === undefined) {
                let category = new HighlighterCategory(name, color, css);
                addStyle(category);
                _categories.push(category);
                save();
                return category;
            }
            return null;
        }
        function update(index, name, color, css) {
            let category = _categories[index];
            removeStyle(category);
            category.name = name;
            category.color = color;
            category.style = css;
            addStyle(category);
            save();
        }
        function remove(index) {
            let category = _categories[index];
            removeStyle(category);
            _categories = _categories.filter(x => x.name !== category.name);
            save();
        }
        function get() {
            return _categories;
        }
        function getIndex(index) {
            return _categories[index];
        }

        function save() {
            GM_setValue('categories', JSON.stringify(_categories));
            init();
            onChange();
        }
        function load() {
            _categories = JSON.parse(GM_getValue('categories') || '[]');
            init();
            onChange();
        }

        this.onChange = null;
        function onChange() {
            if(_.onChange){
                _.onChange(_categories);
            }
        }

        function init() {
            for (let i = 0; i < _categories.length; i++) {
                addStyle(_categories[i]);
            }
        }
        function addStyle(category) {
            document.head.appendChild(new HighlighterStyle(category));
        }
        function removeStyle(category) {
            let ele = document.getElementById(category.styleId);
            if (ele === null) {
                return;
            }
            document.head.removeChild(ele);
        }

        function HighlighterStyle(category) {
            let style = document.createElement('style');
            style.id = category.styleId;
            style.innerHTML = `.${category.elementId}{color:${category.color}} .${category.elementId}${category.style}`;
            return style;
        }
        function HighlighterCategory(name, color, style) {
            this.name = name;
            this.color = color;
            this.elementId = `highlighter-category-${name.replace(/ /g, '-').toLowerCase()}`;
            this.styleId = `highlighter-style-${name.replace(/ /g, '-').toLowerCase()}`;
            this.style = style;
        }
    }
    function HighlighterWordCollection(categoryCollection) {

        let _ = this;
        let _words = [];

        this.get = get;
        this.load = load;
        this.add = add;
        this.update = update;
        this.remove = remove;
        this.enable = enable;
        this.disable = disable;
        this.getIndex = getIndex;
        this.onChange = null;

        function add(word, regex, wholeWord, matchCase, category) {
            if (_words.find(x => x.text === word) === undefined) {
                let highlighterWord = new HighlighterWord(word, regex, wholeWord, matchCase, category);
                _words.push(highlighterWord);
                save();
                return highlighterWord;
            }
            return null;
        }
        function update(index, wholeWord, matchCase, categoryIndex) {
            let word = _words[index];
            word.wholeWord = wholeWord;
            word.matchCase = matchCase;
            word.category = categoryCollection.getIndex(categoryIndex);
            save();
        }
        function remove(string) {
            _words = _words.filter(function (word) {
                return word.text !== string;
            });
            save();
        }
        function enable(index) {
            _words[index].enabled = true;
        }
        function disable(index) {
            _words[index].enabled = false;
        }

        function get() {
            return _words;
        }
        function getIndex(index) {
            return _words[index];
        }

        function init() {
            sort();
            for(let word of _words){
                if (word.regex) {
                    word.expression = makeRegexFromString(word.text);
                }
                else{
                    let _whole = `${word.wholeWord ? '\\b' : ''}`;
                    let _case = `${word.matchCase ? '' : 'i'}`;
                    word.expression = new RegExp(`${_whole}${word.text}${_whole}`, `g${_case}`);
                }
            }
        }
        function sort() {
            _words.sort(function (a, b) {
                let aVal = a.regex ? a.text.length - 150 : a.text.length;
                let bVal = b.regex ? b.text.length - 150 : b.text.length;
                return bVal - aVal;
            });
        }
        function save() {
            init();
            GM_setValue('words', JSON.stringify(_words));
            onChange(_words);
        }
        function load() {
            _words = JSON.parse(GM_getValue('words') || '[]');
            init();
            onChange();
        }
        function loadJson(json) {
            _words = JSON.parse(words);
            save();
        }
        function getJson() {
            return JSON.stringify(_words);
        }

        function onChange() {
            if(_.onChange){
                _.onChange(_words);
            }
        }

        function HighlighterWord(word, regex, wholeWord, matchCase, category) {
            this.enabled = true;
            this.text = word;
            this.regex = regex;
            this.expression = null;
            this.wholeWord = wholeWord;
            this.matchCase = matchCase;
            this.category = category;
        }
    }

    setTimeout(async() => {
        await highlightAll();
        _observer.start();
    },500);
}