function ChatHighlighter() {

    //region JQuery Init
    let $ = window.jQuery = jQuery.noConflict(true);
    $.extend({
        replaceTag: function (element, tagName, withDataAndEvents, deepWithDataAndEvents) {
            let newTag = $("<" + tagName + ">")[0];
            // From [Stackoverflow: Copy all Attributes](http://stackoverflow.com/a/6753486/2096729)
            $.each(element.attributes, function () {
                newTag.setAttribute(this.name, this.value);
            });
            $(element).children().clone(withDataAndEvents, deepWithDataAndEvents).appendTo(newTag);
            return newTag;
        }
    });
    $.fn.extend({
        replaceTag: function (tagName, withDataAndEvents, deepWithDataAndEvents) {
            // Use map to reconstruct the selector with newly created elements
            return this.map(function () {
                return jQuery.replaceTag(this, tagName, withDataAndEvents, deepWithDataAndEvents);
            })
        }
    });
    $.fn.replaceWithPush = function(a) {
        let $a = $(a);
        this.replaceWith($a);
        return $a;
    };
    //endregion

    let _ = this;
    let _ui = null;
    let _observer = new CachedMutationObserver();
    _observer.onObservation = processElement;

    this.words = JSON.parse(GM_getValue('words') || '[]');
    this.categories = JSON.parse(GM_getValue('categories') || '[]');

    (function () {
        initWords();
        sortWords();
        for (let i = 0; i < _.categories.length; i++) {
            addCategoryStyle(_.categories[i]);
        }
        _observer.start();
    })();

    this.attachUI = function (ui) {
        if (ui.constructor.name !== 'UI') {
            _ui = null;
            return false;
        }
        else {
            _ui = ui;
            window.document.body.insertBefore(_ui.element, document.body.childNodes[0]);
            _ui.updateWords();
            _ui.updateCategories();
            return true;
        }
    };

    //region Category Modification Functions
    this.addCategory = function (name, color, css) {
        if (_.categories.find(x => x.name === name) === undefined) {
            let category = new HighlighterCategory(name, color, css);
            addCategoryStyle(category);
            _.categories.push(category);
            _.saveCategories();
            return true;
        }
        return false;
    };
    this.updateCategory = function (categoryIndex, name, color, css) {
        let category = _.categories[categoryIndex];
        removeCategoryStyle(category);
        category.name = name;
        category.color = color;
        category.style = css;
        addCategoryStyle(category);
        _.saveCategories();
    };
    this.removeCategory = function (name) {
        removeCategoryStyle(_.categories.find(function (x) {
            return x.name === name;
        }));
        _.categories = _.categories.filter(function (category) {
            return category.name !== name;
        });
        _.saveCategories();
    };
    this.saveCategories = function () {
        GM_setValue('categories', JSON.stringify(_.categories));
        if (_ui !== null) {
            _ui.updateCategories();
        }
        clearWordHighlights();
        highlightAll();
    };
    //endregion

    //region Word Modification Functions
    this.addWord = function (word, regex, wholeWord, matchCase, category) {
        if (_.words.find(x => x.text === word) === undefined) {
            _.words.push(new HighlighterWord(word, regex, wholeWord, matchCase, category));
            _.saveWords();
            return true;
        }
        return false;
    };
    this.updateWord = function (wordIndex, wholeWord, matchCase, categoryIndex) {
        let word = _.words[wordIndex];
        word.wholeWord = wholeWord;
        word.matchCase = matchCase;
        word.category = _.categories[categoryIndex];
        _.saveWords();
    };
    this.enableWord = function (string) {
        let word = _.words.find(x => x.string === string);
        if (word !== undefined) {
            word.enabled = true;
        }
    };
    this.disableWord = function (string) {
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
        sortWords();
        clearWordHighlights();
        GM_setValue('words', JSON.stringify(_.words));
        highlightAll();
        if (_ui !== null) {
            _ui.updateWords();
        }
    };
    //endregion

    this.highlight = highlightAll;
    this.clearHighlights = clearWordHighlights;

    function isMenuItem(ele) {
        return _ui.element.contains(ele);
    }

    function initWords() {
        for (let i = 0; i < _.words.length; i++) {
            let word = _.words[i];
            if (word.regex) {
                word.expression = makeRegex(word.text);
            }
        }
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

        if (isMenuItem(ele)) {
            return;
        }
        for(let i = 0; i < _.words.length; i++){
            highlightElementTextNodes(ele, _.words[i]);
        }
        let buttons = ele.querySelectorAll('input[type="button"]:not([hidden="true"]):not([style="display:none;"])');
        if (buttons.length > 0) {
            highlightButtonElements(buttons, _.words);
        }

    }

    function highlightElementTextNodes(ele, word) {
        let targetNodes = textNodesUnder(ele);
        if (targetNodes.length !== 0) {
            for (let i = 0; i < targetNodes.length; i++) {
                let node = targetNodes[i];
                if(isMenuItem(node)){continue;}
                replaceWord(node, word.text, word.wholeWord, word.matchCase, word.regex ? word.expression : null, word.category.elementId);
            }
        }
    }
    function highlightButtonElements(eles) {
        let targetElements = eles;
        for (let i = 0; i < targetElements.length; i++) {
            let element = targetElements[i];
            if(isMenuItem(element)){continue;}
            element = convertInputButtonToButton(element);
            for(let j = 0; j < _.words.length; j++){
                highlightElementTextNodes(element, _.words[j]);
            }
        }
    }

    function highlightAll() {
        highlightButtons();
        highlightWords();
    }

    function highlightWords() {
        let targetElements = getTextNodes();
        if (targetElements.length === 0) {return;}
        for (let i = 0; i < targetElements.length; i++) {
            let element = targetElements[i];
            if (isMenuItem(targetElements[i])) {continue;}
            for (let j = 0; j < _.words.length; j++) {
                let word = _.words[j];
                let className = word.category.elementId;
                replaceWord(element, word.text, word.wholeWord, word.matchCase, word.regex ? word.expression : null, className);
            }
        }
    }

    function highlightButtons() {
        let targetElements = document.querySelectorAll('input[type="button"]:not([hidden="true"]):not([style="display:none;"])');
        for (let i = 0; i < targetElements.length; i++) {
            let element = targetElements[i];
            if (isMenuItem(element)) {continue;}
            element = convertInputButtonToButton(element);
            for (let j = 0; j < _.words.length; j++) {
                let word = _.words[j];
                let className = word.category.elementId;
                replaceWord(element, word.text, word.wholeWord, word.matchCase, word.regex ? word.expression : null, className);
            }
        }
    }

    function clearWordHighlights() {
        let spanElements = document.getElementsByTagName('mark');
        let elements = [];
        for (let i = 0; i < spanElements.length; i++) {
            if (spanElements[i].className.indexOf('highlighter-category') > -1) {
                elements.push(spanElements[i]);
            }
        }
        for (let i = 0; i < elements.length; i++) {
            elements[i].outerHTML = elements[i].innerHTML;
        }
    }

    function replaceWord(node, word, whole, match, regex, className) {
        let _whole = `${whole ? '\\b' : ''}`;
        let _match = `${match ? '' : 'i'}`;
        if (node.textContent.trim() === '') {return;}
        let ele = $(node);
        let changed = false;
        let newContent = ele.text().replace(regex || new RegExp(`${_whole}${word}${_whole}`, `g${_match}`), function (match) {
            changed = true;
            return `<mark class='${className}'>${match}</mark>`;
        });
        if (changed) {
            return $(`<mark>${newContent}</mark>`).replaceAll(ele);
        }
        return ele;
    }

    function convertInputButtonToButton(element) {
        let ele = $(element);
        let clone = null;
        try {
            clone = ele.clone().replaceTag('button', true, true);
        }
        catch(e) {
            console.log('Conversion Error');
            console.log(e);
            return null;
        }
        if (clone) {
            clone.append($(`<mark class="highlighter-button-content">${element.value}</mark>`));
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
        catch (e){
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
        let targets = [];
        let eles = document.body.children;
        for (let i = 0; i < eles.length; i++) {
            targets = targets.concat(textNodesUnder(eles[i]));
        }
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

        this.start = function() {
            if(_isObserving){return;}
            _isObserving = true;
            observer.observe(document.body, {characterData: true, subtree: true, childList: true});
        };
        this.stop = function stop() {
            if(_isObserving){
                _isObserving = false;
                observer.disconnect();
            }
        };

        this.onObservation = null;
        function onObservation(element){
            if(_.onObservation !== null){
                if(!isMenuItem(element)){
                    _.onObservation(element);
                }
            }
        }

    }
}