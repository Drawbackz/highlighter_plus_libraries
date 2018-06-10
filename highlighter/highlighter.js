function HighlighterPlus() {

    //region JQuery Init
    let $ = window.jQuery = jQuery.noConflict(true);
    $.extend({
        replaceTag: function (element, tagName, withDataAndEvents, deepWithDataAndEvents) {
            let newTag = $("<" + tagName + ">")[0];
            $.each(element.attributes, function () {
                newTag.setAttribute(this.name, this.value);
            });
            $(element).children().clone(withDataAndEvents, deepWithDataAndEvents).appendTo(newTag);
            return newTag;
        }
    });
    $.fn.extend({
        replaceTag: function (tagName, withDataAndEvents, deepWithDataAndEvents) {
            return this.map(function () {
                return jQuery.replaceTag(this, tagName, withDataAndEvents, deepWithDataAndEvents);
            })
        }
    });
    //endregion
    let _ = this;
    let _ui = null;

    let _observer = new CachedMutationObserver();
    _observer.onObservation = processElement;

    let _highlighting = false;
    let _clearingHighlights = false;
    this.words = JSON.parse(GM_getValue('words') || '[]');
    this.categories = JSON.parse(GM_getValue('categories') || '[]');
    this.enabled = true;

    (function () {
        initWords();
        initCategories();
        _observer.start();
    })();

    function initWords() {
        sortWords();
        for (let i = 0; i < _.words.length; i++) {
            let word = _.words[i];
            if (word.regex) {
                word.expression = makeRegex(word.text);
            }
        }
    }
    function initCategories() {
        for (let i = 0; i < _.categories.length; i++) {
            addCategoryStyle(_.categories[i]);
        }
    }

    this.attachUI = function (ui) {
        if (ui.constructor.name === 'UI') {
            _ui = ui;
            _ui.updateWords();
            _ui.updateCategories();
            window.document.body.insertBefore(_ui.element, document.body.childNodes[0]);
            return;
        }
        _ui = null;
    };

    //region Category Modification Functions
    this.addCategory = function (name, color, css) {
        if (_.categories.find(x => x.name === name) === undefined) {
            let category = new HighlighterCategory(name, color, css);
            addCategoryStyle(category);
            _.categories.push(category);
            _.saveCategories();
            return category;
        }
        return null;
    };
    this.updateCategory = function (index, name, color, css) {
        let category = _.categories[index];
        removeCategoryStyle(category);
        category.name = name;
        category.color = color;
        category.style = css;
        addCategoryStyle(category);
        _.saveCategories();
    };
    this.removeCategory = function (index) {
        let category = _.categories[index];
        removeCategoryStyle(category);
        _.categories = _.categories.filter(x => x.name !== category.name);
        _.saveCategories();
    };
    this.saveCategories = function () {
        highlightAll();
        GM_setValue('categories', JSON.stringify(_.categories));
        if (_ui !== null) {
            _ui.updateCategories();
        }
    };
    //endregion

    //region Word Modification Functions
    this.addWord = function (word, regex, wholeWord, matchCase, category) {
        if (_.words.find(x => x.text === word) === undefined) {
            let highlighterWord = new HighlighterWord(word, regex, wholeWord, matchCase, category)
            _.words.push(highlighterWord);
            initWords();
            _.saveWords();
            return highlighterWord;
        }
        return null;
    };
    this.updateWord = function (index, wholeWord, matchCase, categoryIndex) {
        let word = _.words[index];
        word.wholeWord = wholeWord;
        word.matchCase = matchCase;
        word.category = _.categories[categoryIndex];
        initWords();
        _.saveWords();
    };
    this.enableWord = function (index) {
        let word = _.words[index];
        if (word === undefined) {
            return;
        }
        word.enabled = true;
    };
    this.disableWord = function (index) {
        let word = _.words.find(x => x.string === string);
        if (word !== undefined) {
            word.enabled = false;
        }
    };
    this.removeWord = function (string) {
        _.words = _.words.filter(function (word) {
            return word.text !== string;
        });
        _.saveWords();
    };
    this.saveWords = function () {
        initWords();
        highlightAll();
        GM_setValue('words', JSON.stringify(_.words));
        if (_ui !== null) {
            _ui.updateWords();
        }
    };
    //endregion

    this.highlight = highlightAll;
    this.clearHighlights = clearWordHighlights;

    function isMenuItem(ele) {
        if(!_.enabled){return;}
        let highlighterButtonContainer = document.getElementById('highlighter-button-container');
        if(highlighterButtonContainer){
            return document.getElementById('highlighter-button-container').contains(ele) || _ui.element.contains(ele);
        }
        return _ui.element.contains(ele);
    }

    function sortWords() {
        _.words.sort(function (a, b) {
            let aVal = a.regex ? a.text.length - 150 : a.text.length;
            let bVal = b.regex ? b.text.length - 150 : b.text.length;
            return bVal - aVal;
        });
    }

    function addCategoryStyle(category) {
        document.head.appendChild(new HighlighterStyle(category));
    }

    function removeCategoryStyle(category) {
        let ele = document.getElementById(category.styleId);
        if (ele === null) {
            return;
        }
        document.head.removeChild(ele);
    }

    function processElement(ele) {
        if (isMenuItem(ele)) {return;}
        console.time('processElement');
        let buttons = ele.querySelectorAll('input[type="button"]:not([hidden="true"]):not([style="display:none;"])');
        if (buttons.length > 0) {
            highlightButtonElements(buttons, _.words);
        }
        else{
            for (let i = 0; i < _.words.length; i++) {
                highlightElementTextNodes(ele, _.words[i]);
            }
        }
        console.timeEnd('processElement');
    }

    function highlightElementTextNodes(ele, word) {
        if(ele.className){
            if(ele.className.indexOf('highlighter-')){return;}
        }
        let targetNodes = textNodesUnder(ele);
        if (targetNodes.length !== 0) {
            for (let i = 0; i < targetNodes.length; i++) {
                let node = targetNodes[i];
                if (isMenuItem(node)) {continue;}
                replaceWord(node, word.text, word.wholeWord, word.matchCase, word.regex ? word.expression : null, word.category.elementId);
            }
        }
    }

    function highlightButtonElements(eles) {
        let targetElements = eles;
        for (let i = 0; i < targetElements.length; i++) {
            let element = targetElements[i];
            if (isMenuItem(element)) {
                console.timeEnd('highlightButtonElements');
                continue;
            }
            element = convertInputButtonToButton(element);
            for (let j = 0; j < _.words.length; j++) {
                highlightElementTextNodes(element, _.words[j]);
            }
        }
    }

    function highlightAll() {
        if(_highlighting){return;}
        _highlighting = true;
        console.time('highlightTime');
        clearWordHighlights();
        highlightButtons();
        highlightWords();
        console.timeEnd('highlightTime');
        _highlighting = false;
    }

    function highlightWords() {
        console.time('highlightWords');
        let targetElements = getTextNodes();
        if (targetElements.length === 0) {return;}
        for (let i = 0; i < targetElements.length; i++) {
            let element = targetElements[i];
            if (isMenuItem(targetElements[i])) {
                continue;
            }
            for (let j = 0; j < _.words.length; j++) {
                let word = _.words[j];
                let className = word.category.elementId;
                replaceWord(element, word.text, word.wholeWord, word.matchCase, word.regex ? word.expression : null, className);
            }
        }
        console.timeEnd('highlightWords');
    }

    function highlightButtons() {
        console.time('highlightingButtons');
        let targetElements = document.querySelectorAll('input[type="button"]:not([hidden="true"]):not([style="display:none;"])');
        if (targetElements.length > 0) {
            for (let i = 0; i < targetElements.length; i++) {
                let element = targetElements[i];
                if (isMenuItem(element)) {
                    continue;
                }
                element = convertInputButtonToButton(element);
                for (let j = 0; j < _.words.length; j++) {
                    let word = _.words[j];
                    let className = word.category.elementId;
                    replaceWord(element, word.text, word.wholeWord, word.matchCase, word.regex ? word.expression : null, className);
                }
            }
        }
        else {
            targetElements = document.querySelectorAll('button[class="highlighter-button"]');
            if (targetElements.length > 0) {
                for (let i = 0; i < targetElements.length; i++) {
                    let element = targetElements[i];
                    for (let j = 0; j < _.words.length; j++) {
                        let word = _.words[j];
                        highlightElementTextNodes(element, word);
                    }
                }
            }
        }
        console.timeEnd('highlightingButtons');
    }

    function clearWordHighlights() {
        if(_clearingHighlights){return;}
        console.log('CLEARING');
        console.time('clearingHighlights');
        _clearingHighlights = true;
        let moddedButtonElements = document.querySelectorAll('button[class="highlighter-button"]');
        for (let i = 0; i < moddedButtonElements.length; i++) {
            let element = moddedButtonElements[i];
            element.innerHTML = element.value;
        }
        let marks;
        while ((marks = document.getElementsByTagName('mark')).length > 0) {
            for(let i = 0; i < marks.length; i++){
                marks[i].outerHTML = marks[i].innerHTML;
            }
        }
        document.body.normalize();
        console.timeEnd('clearingHighlights');
        _clearingHighlights = false;
    }

    function replaceWord(node, word, whole, match, regex, className) {
        let _whole = `${whole ? '\\b' : ''}`;
        let _match = `${match ? '' : 'i'}`;
        if (node.textContent.trim() === '') {
            return;
        }
        let ele = $(node);
        let changed = false;
        let newContent = ele.text().replace(regex || new RegExp(`${_whole}${word}${_whole}`, `g${_match}`), function (match) {
            changed = true;
            return `<mark class='${className}'>${match}</mark>`;
        });
        if (changed) {
            $(`<mark>${newContent}</mark>`).replaceAll(ele);
        }
    }

    function convertInputButtonToButton(element) {
        let ele = $(element);
        let clone = null;
        try {
            clone = ele.clone().replaceTag('button', true, true);
        }
        catch (e) {
            console.log('Conversion Error');
            console.log(e);
            return null;
        }
        if (clone) {
            clone.addClass('highlighter-button');
            clone.html(element.value);
            ele.replaceWith(clone);
            return clone[0];
        }
        return null;
    }

    function makeRegex(string) {
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

    function getTextNodes() {
        console.time('getTextNodes');
        let targets = [];
        let eles = document.body.children;
        for (let i = 0; i < eles.length; i++) {
            targets = targets.concat(textNodesUnder(eles[i]));
        }
        console.timeEnd('getTextNodes');
        return targets;
    }

    function textNodesUnder(el) {
        let n, a = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        while (n = walk.nextNode()) a.push(n);
        return a;
    }

    function HighlighterStyle(category) {
        let style = document.createElement('style');
        style.id = category.styleId;
        style.innerHTML = `.${category.elementId}{color:${category.color}} .${category.elementId}${category.style}`;
        return style;
    }

    function HighlighterCategory(name, color, style) {
        let _ = this;
        this.name = name;
        this.color = color;
        this.elementId = `highlighter-category-${name.replace(/ /g, '-').toLowerCase()}`;
        this.styleId = `highlighter-style-${_.name.replace(/ /g, '-').toLowerCase()}`;
        this.style = style;
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

    function CachedMutationObserver() {

        let _ = this;
        let _cache = [];
        let _isObserving = false;

        let observer = new MutationObserver(function (list) {
            if (_clearingHighlights || _highlighting) {return;}
            for (let mutation of list) {
                let cachedElement = _cache.find(function (ele) {
                    return ele.isEqualNode(mutation.target) || mutation.target.id === ele.id;
                });
                if (cachedElement) {
                    return;
                }
                else {
                    _cache.push(mutation.target);
                    setTimeout(function () {
                        _cache.pop();
                    }, 500);
                }
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    onObservation(mutation.target);
                }
            }
        });

        this.start = function () {
            if (_isObserving) {
                return;
            }
            _isObserving = true;
            observer.observe(document.body, {characterData: true, subtree: true, childList: true});
        };
        this.stop = function stop() {
            if (_isObserving) {
                _isObserving = false;
                observer.disconnect();
            }
        };

        this.onObservation = null;

        function onObservation(element) {
            if (_.onObservation !== null) {
                _.onObservation(element);
            }
        }

    }

}