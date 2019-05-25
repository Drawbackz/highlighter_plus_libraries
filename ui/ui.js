function UI(highlighter, titleText, menuToggledAction, customMenuButton) {

    let $ = window.jQuery = jQuery.noConflict(true);

    (async function () {
        let style = document.createElement("link");
        style.rel = "stylesheet";
        style.href = await GM.getResourceUrl("colorPickerCSS");
        window.document.head.appendChild(style);
    })();

    //region Private Members

    let _ = this;

    let _messageTimeout = null;

    let _highlighter = highlighter;
    let _menuContainer = new MenuContainer();
    let _creationForm = new CreationForm(_menuContainer);
    let _updateForm = new UpdateForm(_menuContainer);

    //endregion

    //region Public Members

    this.element = _menuContainer.element;
    this.showMessage = _menuContainer.showMessage;

    this.updateWords = function (words) {

        if (words.length === 0) {
            _updateForm.word.updateDropDowns([new Option('No Words Available')]);
            return;
        }

        let options = [new Option('Select a word')];

        for (let i = 0; i < words.length; i++) {
            let word = words[i];
            options.push(new Option(word.text, i));
        }

        _updateForm.word.updateDropDowns(options);

    };
    this.updateCategories = function (categories) {

        if (categories.length === 0) {
            _updateForm.category.updateDropDowns([new Option('No Categories Available')]);
            return;
        }

        let options = [new Option('Select a category')];

        for (let i = 0; i < categories.length; i++) {
            let category = categories[i];
            options.push(new Option(category.name, i));
        }

        _updateForm.category.updateDropDowns(options);
        _creationForm.word.updateDropDowns(options);

    };

    //endregion

    //region Creation Form Event Handlers

    _creationForm.onWordAdded = function () {
        if (_creationForm.word.isValid()) {
            let word = _creationForm.word.text();
            let category = _highlighter.categoryCollection.get()[_creationForm.word.category()];
            _highlighter.wordCollection.add(word, _creationForm.word.rexeg(), _creationForm.word.wholeWord(), _creationForm.word.matchCase(), category);
            _creationForm.word.reset();
            _highlighter.reHighlight();
        }
        else {
            _.showMessage(_creationForm.lastError, true);
        }
    };
    _creationForm.onCategoryAdded = function () {
        if (_creationForm.category.isValid()) {
            _highlighter.categoryCollection.add(_creationForm.category.name(), _creationForm.category.color(), _creationForm.category.backgroundColor(), _creationForm.category.css());
            _creationForm.category.reset();
        }
        else {
            _.showMessage(_creationForm.lastError, true);
        }
    };

    //endregion

    //region Update Form Event Handlers

    _updateForm.onWordSelectChanged = function () {
        let index = _updateForm.word.selectedIndex();
        if (index === 'undefined') {
            _updateForm.word.reset();
        }
        else {
            _updateForm.word.set(_highlighter.wordCollection.getIndex(index));
        }
    };
    _updateForm.onWordUpdated = function () {
        if (_updateForm.word.isValid()) {
            _highlighter.wordCollection.update(_updateForm.word.selectedIndex(), _updateForm.word.wholeWord(), _updateForm.word.matchCase(), _updateForm.word.newCategoryIndex());
            _updateForm.word.reset();
        }
        else {
            _.showMessage(_updateForm.lastError, true);
        }
    };
    _updateForm.onWordRemoved = function () {
        if (_updateForm.word.isValid()) {
            _highlighter.wordCollection.remove(_highlighter.wordCollection.getIndex(_updateForm.word.selectedIndex()).text);
            _updateForm.word.reset();
        }
        else {
            _.showMessage(_updateForm.lastError, true);
        }
    };

    _updateForm.onCategorySelectChanged = function () {
        let index = _updateForm.category.selectedIndex();
        if (index === 'undefined') {
            _updateForm.category.reset();
        }
        else {
            _updateForm.category.set(_highlighter.categoryCollection.getIndex(index));
        }
    };
    _updateForm.onCategoryUpdated = function () {
        if (_updateForm.category.isValid()) {
            _highlighter.categoryCollection.update(_updateForm.category.selectedIndex(), _updateForm.category.newName(), _updateForm.category.newColor(), _updateForm.category.newBackgroundColor(), _updateForm.category.css());
            _updateForm.category.reset();
        }
        else {
            _.showMessage(_updateForm.lastError, true);
        }
    };
    _updateForm.onCategoryRemoved = function () {
        if (_updateForm.category.isValid()) {
            _highlighter.categoryCollection.remove(_updateForm.category.selectedIndex());
            _updateForm.category.reset();
        }
        else {
            _.showMessage(_updateForm.lastError, true);
        }
    };

    //endregion

    if(menuToggledAction){
        _menuContainer.onMenuToggle = menuToggledAction;
    }

    this.showMessage = function (message, isError) {
        isError = isError || false;
        if (_messageTimeout !== null) {
            clearTimeout(_messageTimeout);
        }
        $(_menuContainer.normalMessageElement).finish();
        $(_menuContainer.errorMessageElement).finish();
        $(_menuContainer.titleMessageElement).fadeOut('fast', function () {
            if (isError) {
                showErrorMessage(message);
            }
            else {
                showNormalMessage(message);
            }
        });
    };

    function showErrorMessage(message) {
        $(_menuContainer.normalMessageElement).fadeOut('slow', function () {
            let errorEle = $(_menuContainer.errorMessageElement);
            _menuContainer.errorMessageElement.innerHTML = message;
            errorEle.fadeIn('slow', function () {
                _messageTimeout = setTimeout(function () {
                    errorEle.fadeOut('slow', function () {
                        $(_menuContainer.titleMessageElement).fadeIn('fast');
                    });
                }, 3000);
            });
        });
    }
    function showNormalMessage(message) {
        $(_menuContainer.errorMessageElement).fadeOut('slow', function () {
            let normalEle = $(_menuContainer.normalMessageElement);
            _menuContainer.normalMessageElement.innerHTML = message;
            normalEle.fadeIn('slow', function () {
                _messageTimeout = setTimeout(function () {
                    normalEle.fadeOut('slow', function () {
                        $(_menuContainer.titleMessageElement).fadeIn('fast');
                    });
                }, 3000);
            });
        });
    }

    function MenuContainer() {

        //region Style
        let style = document.createElement('style');
        style.innerHTML = '#highlighter-menu-container {\n' +
            '    all:unset;\n' +
            '    position: fixed;\n' +
            '    top: 0;\n' +
            '    left: 0;\n' +
            '    display: none;\n' +
            '    width: 100%;\n' +
            '    background-color: black;\n' +
            '    color: white;\n' +
            '    border-radius: 5px;\n' +
            '    z-index: 999999;\n' +
            '}\n' +
            '#highlighter-menu-content{\n' +
            '    width: 100%;\n' +
            '    position: relative;\n' +
            '    display: inline-flex;\n' +
            '}\n' +
            '#highlighter-menu-notification-container{\n' +
            '    padding: 10px;\n' +
            '    position: relative;\n' +
            '    text-align: center;\n' +
            '    height: 35px;\n' +
            '}\n' +
            '#highlighter-menu-error-message{\n' +
            '    display: none;\n' +
            '    color: red;\n' +
            '}\n' +
            '#highlighter-menu-normal-message{\n' +
            '    display: none;\n' +
            '    color: limegreen;\n' +
            '}\n' +
            '.highlighter-notification-message{\n' +
            '    position: absolute;\n' +
            '    left: 0;\n' +
            '    right: 0;\n' +
            '    top: 0;\n' +
            '    bottom:0;\n' +
            '    margin-top: 17px;\n' +
            '    font-size: 20px;\n' +
            '}\n' +
            '.highlighter-form-container{\n' +
            '    width: 100%;\n' +
            '    background-color: gray;\n' +
            '    margin: 5px;\n' +
            '    padding: 10px;\n' +
            '    border: solid white 1px;\n' +
            '}\n' +
            '.highlighter-input{\n' +
            '    width: 100%;\n' +
            '    box-sizing: border-box;\n' +
            '    height: auto;\n' +
            '}\n' +
            'input.highlighter-input{\n' +
            '    height: 30px;\n' +
            '}\n' +
            'select.highlighter-input{\n' +
            '    height: 30px;\n' +
            '}\n' +
            '.sp-replacer.sp-light{\n' +
            '    height: 21px;\n' +
            '    border-radius: 5px;\n' +
            '}\n' +
            '.highlighter-group-box{\n' +
            '    border: solid white 1px;\n' +
            '    padding-left: 5px;\n' +
            '    padding-right: 5px;\n' +
            '    padding-bottom: 5px;\n' +
            '    margin: 5px;\n' +
            '    margin-bottom: 15px;\n' +
            '    border-radius: 5px;\n' +
            '}\n' +
            '.highlighter-group-box-title{\n' +
            '    display: inline-block;\n' +
            '    position: relative;\n' +
            '    top:-13px;\n' +
            '    background-color: gray;\n' +
            '    padding-right: 3px;\n' +
            '    padding-left: 3px;\n' +
            '}\n' +
            '.highlighter-stacked-container{\n' +
            '    width: 100%;\n' +
            '}\n' +
            '.highlighter-inline-container{\n' +
            '    display: inline-flex;\n' +
            '    width: 100%;\n' +
            '}\n' +
            '.highlighter-input-label{\n' +
            '    line-height: 30px;\n' +
            '    margin-left: 5px;\n' +
            '    margin-right: 5px;\n' +
            '    text-align: right;\n' +
            '    width: 93px !important;\n' +
            '}\n' +
            'input[type=\'checkbox\'] {\n' +
            '    height: 27px;\n' +
            '    margin-left: 0px;\n' +
            '}\n' +
            'mark{\n' +
            '    all:unset;\n' +
            '    color:inherit;\n' +
            '    background-color: inherit;\n' +
            '}';
        window.document.head.appendChild(style);
        //endregion
        //region HTML

        let html = '    <div id="highlighter-menu-notification-container">\n' +
            '        <div id="highlighter-menu-title-message" class="highlighter-notification-message"></div>\n' +
            '        <div id="highlighter-menu-normal-message" class="highlighter-notification-message"></div>\n' +
            '        <div id="highlighter-menu-error-message" class="highlighter-notification-message"></div>\n' +
            '    </div>\n' +
            '    <div id="highlighter-menu-content"></div>';


        //endregion

        let _ = this;

        let menuContainer = window.document.createElement('div');
        menuContainer.id = 'highlighter-menu-container';
        menuContainer.innerHTML = html;

        this.titleMessageElement = menuContainer.querySelector('div[id="highlighter-menu-title-message"]');
        this.normalMessageElement = menuContainer.querySelector('div[id="highlighter-menu-normal-message"]');
        this.errorMessageElement = menuContainer.querySelector('div[id="highlighter-menu-error-message"]');
        this.menuContent = menuContainer.querySelector('div[id="highlighter-menu-content"]');

        this.element = menuContainer;
        this.content = _.menuContent;

        this.onMenuToggle = null;

        _.titleMessageElement.innerHTML = titleText;
        $(_.titleMessageElement).show();

        if (window === top) {

            let buttonContainer = document.createElement('div');
            buttonContainer.id = 'highlighter-button-container';
            buttonContainer.style = 'display:inline-flex; cursor: pointer; z-index: 10000000; position: fixed; top:0; right:0;';
            document.body.appendChild(buttonContainer);

            let menuButton = document.createElement('button');
            menuButton.innerHTML = 'H+';
            buttonContainer.appendChild(menuButton);
            menuButton.onclick = () => {
                console.log(_.element.style.display);
                let visible = _.element.style.display === 'block';
                if(visible){
                    _.element.style.display = 'none';
                }
                else {
                    _.element.style.display = 'block';
                }
                sendMenuToggled(!visible);
            };

            if(customMenuButton){
                $(customMenuButton).addClass('highlighter-custom-button');
                buttonContainer.appendChild(customMenuButton);
            }
        }

        function sendMenuToggled(isVisible) {
            if(_.onMenuToggle){_.onMenuToggle(isVisible);}
        }

        return this;
    }

    function UpdateForm(menuContainer) {

        let _ = this;
        let _container = new Container();
        menuContainer.content.appendChild(_container.element);

        this.lastError = null;

        this.word = {
            set: function (word) {
                let selector = _container.word.categorySelector;
                _container.word.regexCheck.checked = word.regex;
                _container.word.wholeWordCheck.checked = word.wholeWord;
                _container.word.matchCaseCheck.checked = word.matchCase;
                for (let i = 0; i < selector.options.length; i++) {
                    if (selector.options[i].text === word.category.name) {
                        selector.selectedIndex = i;
                        break;
                    }
                }
            },
            selectedIndex: function () {
                return _container.word.selector[_container.word.selector.selectedIndex].value;
            },
            newCategoryIndex: function () {
                return _container.category.selector[_container.word.categorySelector.selectedIndex].value;
            },
            regex: function () {
                return _container.word.regexCheck.checked;
            },
            wholeWord: function () {
                return _container.word.wholeWordCheck.checked;
            },
            matchCase: function () {
                return _container.word.matchCaseCheck.checked;
            },
            reset: function () {
                _container.word.selector.selectedIndex = 0;
                _container.word.categorySelector.selectedIndex = 0;
                _container.word.regexCheck.checked = false;
                _container.word.matchCaseCheck.checked = false;
                _container.word.wholeWordCheck.checked = false;
            },
            updateDropDowns: function (wordOptions) {
                $(_container.word.selector).empty();
                for (let i = 0; i < wordOptions.length; i++) {
                    _container.word.selector.add(wordOptions[i]);
                }
                _.word.reset();
            },
            isValid: function () {
                _.lastError = null;
                let wordIndex = _container.word.selector.selectedIndex;
                let categoryIndex = _container.word.categorySelector.selectedIndex;
                if (wordIndex === 0) {
                    _.lastError = "No Word Selected";
                    return false;
                }
                if (categoryIndex === 0) {
                    _.lastError = "No Category Selected";
                    return false;
                }
                return true;
            }
        };
        this.category = {
            set: function (category) {
                _container.category.name.value = category.name;
                $(_container.category.textColorSelector).spectrum('set', category.color);
                $(_container.category.backgroundColorSelector).spectrum('set', category.backgroundColor);
                _container.category.customCssTextArea.value = category.style;
                _container.category.customCssTextArea.placeholder = `.${category.elementId}`;
            },
            selectedIndex: function () {
                return _container.category.selector[_container.category.selector.selectedIndex].value;
            },
            newName: function () {
                let value = _container.category.name.value.trim();
                if (value.length === 0) {
                    return null;
                }
                return value;
            },
            newColor: function () {
                return $(_container.category.textColorSelector).spectrum('get').toRgbString();
            },
            newBackgroundColor: function () {
                return $(_container.category.backgroundColorSelector).spectrum('get').toRgbString();
            },
            css: function () {
                return _container.category.customCssTextArea.value;
            },
            reset: function () {
                _container.category.name.value = '';
                _container.category.selector.selectedIndex = 0;
                _container.category.customCssTextArea.value = '';
                $(_container.category.textColorSelector).spectrum('set', '#000000');
                $(_container.category.backgroundColorSelector).spectrum('set', '#ffff00');
            },
            updateDropDowns: function (categoryOptions) {
                $(_container.word.categorySelector).empty();
                $(_container.category.selector).empty();
                for (let i = 0; i < categoryOptions.length; i++) {
                    _container.word.categorySelector.add(categoryOptions[i].cloneNode(true));
                    _container.category.selector.add(categoryOptions[i].cloneNode(true));
                }
                _.category.reset();
            },
            isValid: function () {
                _.lastError = null;
                let name = _container.category.name.value.trim();
                let categoryIndex = _container.category.selector.selectedIndex;
                if (categoryIndex === 0) {
                    _.lastError = "A Category Needs To Be Selected";
                    return false;
                }
                if (name.length === 0) {
                    _.lastError = "Category Name Is Required";
                    return false;
                }
                return true;
            }
        };

        //region Events
        this.onCategorySelectChanged = null;
        _container.category.selector.onchange = function () {
            if (_.onCategorySelectChanged !== null) {
                _.onCategorySelectChanged();
            }
        };

        this.onCategoryUpdated = null;
        _container.category.updateButton.onclick = function () {
            if (_.onCategoryUpdated !== null) {
                _.onCategoryUpdated();
            }
        };

        this.onCategoryRemoved = null;
        _container.category.removeButton.onclick = function () {
            if (_.onCategoryRemoved !== null) {
                _.onCategoryRemoved();
            }
        };

        this.onWordSelectChanged = null;
        _container.word.selector.onchange = function () {
            if (_.onWordSelectChanged !== null) {
                _.onWordSelectChanged();
            }
        };

        this.onWordUpdated = null;
        _container.word.updateButton.onclick = function () {
            if (_.onWordUpdated !== null) {
                _.onWordUpdated();
            }
        };

        this.onWordRemoved = null;
        _container.word.removeButton.onclick = function () {
            if (_.onWordRemoved !== null) {
                _.onWordRemoved();
            }
        };
        //endregion

        return this;

        function Container() {
            //region HTML
            let html = '<div id="highlighter-category-update-container" class="highlighter-group-box">\n' +
                '        <div class="highlighter-group-box-title">Category Updater</div>\n' +
                '        <div class="highlighter-inline-container">\n' +
                '            <label class="highlighter-input-label" for="highlighter-update-category-select">Category:</label>\n' +
                '            <select class="highlighter-input" id="highlighter-update-category-select">\n' +
                '                <option selected>No Categories Available</option>\n' +
                '            </select>\n' +
                '            <input id=\'highlighter-update-category-text-color\'/>\n' +
                '            <input id=\'highlighter-update-category-background-color\'/>\n' +
                '        </div>\n' +
                '        <div class="highlighter-inline-container">\n' +
                '            <label class="highlighter-input-label" for="highlighter-update-category-name">Name:</label>\n' +
                '            <input type="text" class="highlighter-input" id="highlighter-update-category-name" placeholder="Name"/>\n' +
                '        </div>\n' +
                '        <div class="highlighter-inline-container">\n' +
                '            <label class="highlighter-input-label" for="highlighter-update-custom-css-text-area">CSS:</label>\n' +
                '            <textarea class="highlighter-input" id="highlighter-update-custom-css-text-area" placeholder="Custom CSS"></textarea>\n' +
                '        </div>\n' +
                '        <button class="highlighter-input" id="highlighter-update-category-btn">Update</button>\n' +
                '        <button class="highlighter-input" id="highlighter-remove-category-btn">Remove</button>\n' +
                '    </div>\n' +
                '\n' +
                '    <div id="highlighter-word-update-container" class="highlighter-group-box">\n' +
                '        <div class="highlighter-group-box-title">Word Updater</div>\n' +
                '        <div class="highlighter-inline-container">\n' +
                '            <label class="highlighter-input-label" for="highlighter-update-word-select">Word:</label>\n' +
                '            <select class="highlighter-input" id="highlighter-update-word-select">\n' +
                '                <option selected>No Words Available</option>\n' +
                '            </select>\n' +
                '            <label for="highlighter-update-word-regex-chk" class="highlighter-input-label">Regex:</label>\n' +
                '            <input type="checkbox" id="highlighter-update-word-regex-chk" disabled="disabled">\n' +
                '            <label for="highlighter-update-word-whole-word-chk" class="highlighter-input-label">Whole:</label>\n' +
                '            <input type="checkbox" id="highlighter-update-word-whole-word-chk">\n' +
                '            <label for="highlighter-update-word-case-sensitive-chk" class="highlighter-input-label">Case:</label>\n' +
                '            <input type="checkbox" id="highlighter-update-word-case-sensitive-chk">\n' +
                '        </div>\n' +
                '        <div class="highlighter-inline-container">\n' +
                '            <label class="highlighter-input-label" for="highlighter-update-word-category-select">Category:</label>\n' +
                '            <select class="highlighter-input" id="highlighter-update-word-category-select">\n' +
                '                <option selected>No Categories Available</option>\n' +
                '            </select>\n' +
                '        </div>\n' +
                '        <button class="highlighter-input" id="highlighter-update-word-btn">Update</button>\n' +
                '        <button class="highlighter-input" id="highlighter-remove-word-btn">Remove</button>\n' +
                '    </div>';
            //endregion

            let _ = this;

            let _container = window.document.createElement('div');
            _container.id = 'highlighter-update-container';
            _container.className = "highlighter-form-container";
            _container.innerHTML = html;

            _.element = _container;

            _.word = {
                selector: _container.querySelector('select[id="highlighter-update-word-select"]'),
                regexCheck: _container.querySelector('input[id="highlighter-update-word-regex-chk"]'),
                wholeWordCheck: _container.querySelector('input[id="highlighter-update-word-whole-word-chk"]'),
                matchCaseCheck: _container.querySelector('input[id="highlighter-update-word-case-sensitive-chk"]'),
                categorySelector: _container.querySelector('select[id="highlighter-update-word-category-select"]'),
                updateButton: _container.querySelector('button[id="highlighter-update-word-btn"]'),
                removeButton: _container.querySelector('button[id="highlighter-remove-word-btn"]'),
            };

            _.category = {
                selector: _container.querySelector('select[id="highlighter-update-category-select"]'),
                textColorSelector: $(_container.querySelector('input[id="highlighter-update-category-text-color"]')),
                backgroundColorSelector: $(_container.querySelector('input[id="highlighter-update-category-background-color"]')),
                name: _container.querySelector('input[id="highlighter-update-category-name"]'),
                customCssTextArea: _container.querySelector('textarea[id="highlighter-update-custom-css-text-area"]'),
                updateButton: _container.querySelector('button[id="highlighter-update-category-btn"]'),
                removeButton: _container.querySelector('button[id="highlighter-remove-category-btn"]')
            };

            $(_.category.textColorSelector).spectrum({
                color: "#000000",
                showAlpha: true
            });
            $(_.category.backgroundColorSelector).spectrum({
                color: "#ffff00",
                showAlpha: true
            });

            return _;
        }
    }
    function CreationForm(menuContainer) {

        let _ = this;
        let _container = new Container();
        menuContainer.content.appendChild(_container.element);

        this.lastError = null;

        this.word = {
            text: function () {
                return _container.word.text.value;
            },
            category: function () {
                return _container.word.categorySelector[_container.word.categorySelector.selectedIndex].value;
            },
            rexeg: function () {
                return _container.word.regexCheck.checked;
            },
            matchCase: function () {
                return _container.word.matchCaseCheck.checked;
            },
            wholeWord: function () {
                return _container.word.wholeWordCheck.checked;
            },
            updateDropDowns: function (categoryOptions) {
                $(_container.word.categorySelector).empty();
                for (let i = 0; i < categoryOptions.length; i++) {
                    _container.word.categorySelector.add(categoryOptions[i].cloneNode(true));
                }
            },
            reset: function () {
                _container.word.text.value = '';
                _container.word.categorySelector.selectedIndex = 0;
                _container.word.regexCheck.checked = false;
                _container.word.matchCaseCheck = false;
                _container.word.wholeWordCheck = false;
            },
            isValid: function () {
                _.lastError = null;
                let text = _container.word.text.value.trim();
                let categoryIndex = _container.word.categorySelector.selectedIndex;
                if (text.length === 0) {
                    _.lastError = "A Name Is Required";
                    return false;
                }
                if (categoryIndex === 0) {
                    _.lastError = "A Category Is Required";
                    return false;
                }
                if (_container.word.regexCheck) {
                    try {
                        new RegExp(text);
                    }
                    catch (e) {
                        _.lastError = "Invalid Regex";
                        return false;
                    }
                }
                return true;
            }
        };
        this.category = {
            name: function () {
                return _container.category.name.value;
            },
            color: function () {
                return $(_container.category.textColorSelector).spectrum('get').toRgbString();
            },
            backgroundColor: function () {
                return $(_container.category.backgroundColorSelector).spectrum('get').toRgbString();
            },
            css: function () {
                return _container.category.customCssTextArea.value || '';
            },
            reset: function () {
                _container.category.name.value = '';
                _container.category.customCssTextArea.value = '';
                $(_container.category.textColorSelector).spectrum('set', '#000000');
                $(_container.category.backgroundColorSelector).spectrum('set', '#ffff00');
            },
            isValid: function () {
                _.lastError = null;
                let name = _container.category.name.value.trim();
                if (name.length === 0) {
                    _.lastError = "A Name Is Required";
                    return false;
                }
                return true;
            }
        };

        //region Events
        this.onWordAdded = null;
        _container.word.addButton.onclick = function () {
            if (_.onWordAdded !== null) {
                _.onWordAdded();
            }
        };

        this.onCategoryAdded = null;
        _container.category.addButton.onclick = function () {
            if (_.onCategoryAdded !== null) {
                _.onCategoryAdded();
            }
        };
        //endregion

        return this;

        function Container() {
            //region HTML
            let html = '<div id="highlighter-create-category-container" class="highlighter-group-box">\n' +
                '        <div class="highlighter-group-box-title">Category Creator</div>\n' +
                '        <div class="highlighter-inline-container">\n' +
                '            <label for="highlighter-create-category-name" class="highlighter-input-label">Category:</label>\n' +
                '            <input type="text" class="highlighter-input" id="highlighter-create-category-name" placeholder="Name"/>\n' +
                '            <input id=\'highlighter-create-category-text-color\'/>\n' +
                '            <input id=\'highlighter-create-category-background-color\'/>\n' +
                '        </div>\n' +
                '        <div class="highlighter-inline-container">\n' +
                '            <label class="highlighter-input-label" for="highlighter-create-custom-css-text-area">CSS:</label>\n' +
                '            <textarea class="highlighter-input" id="highlighter-create-custom-css-text-area" placeholder="Custom CSS"></textarea>\n' +
                '        </div>\n' +
                '        <button class="highlighter-input" id="highlighter-add-category-btn">Add Category</button>\n' +
                '    </div>\n' +
                '\n' +
                '    <div id="highlighter-create-word-container" class="highlighter-group-box">\n' +
                '        <div class="highlighter-group-box-title">Word Creator</div>\n' +
                '        <div id="highlighter-stacked-container">\n' +
                '            <div class="highlighter-inline-container">\n' +
                '                <label for="highlighter-create-word-text" class="highlighter-input-label">Word:</label>\n' +
                '                <input type="text" class="highlighter-input" id="highlighter-create-word-text" placeholder="Text"/>\n' +
                '                <label for="highlighter-create-word-regex-chk" class="highlighter-input-label">Regex:</label>\n' +
                '                <input type="checkbox" id="highlighter-create-word-regex-chk">\n' +
                '                <label for="highlighter-create-word-whole-word-chk" class="highlighter-input-label">Whole:</label>\n' +
                '                <input type="checkbox" id="highlighter-create-word-whole-word-chk">\n' +
                '                <label for="highlighter-create-word-case-sensitive-chk" class="highlighter-input-label">Case:</label>\n' +
                '                <input type="checkbox" id="highlighter-create-word-case-sensitive-chk">\n' +
                '            </div>\n' +
                '            <div class="highlighter-inline-container">\n' +
                '                <label class="highlighter-input-label" for="highlighter-create-word-category">Category:</label>\n' +
                '                <select class="highlighter-input" id="highlighter-create-word-category">\n' +
                '                    <option selected>No Categories Available</option>\n' +
                '                </select>\n' +
                '            </div>\n' +
                '            <div id="highlighter-create-word-category-color"></div>\n' +
                '        </div>\n' +
                '        <button class="highlighter-input" id="highlighter-add-word-btn">Add Word</button>\n' +
                '    </div>';
            //endregion

            let _ = this;

            let _container = window.document.createElement('div');
            _container.id = 'highlighter-create-container';
            _container.className = "highlighter-form-container";
            _container.innerHTML = html;

            _.element = _container;

            _.word = {
                text: _container.querySelector('input[id="highlighter-create-word-text"]'),
                categorySelector: _container.querySelector('select[id="highlighter-create-word-category"]'),
                colorPreviewElement: _container.querySelector('input[id="highlighter-create-word-category-color"]'),
                regexCheck: _container.querySelector('input[id="highlighter-create-word-regex-chk"]'),
                wholeWordCheck: _container.querySelector('input[id="highlighter-create-word-whole-word-chk"]'),
                matchCaseCheck: _container.querySelector('input[id="highlighter-create-word-case-sensitive-chk"]'),
                addButton: _container.querySelector('button[id="highlighter-add-word-btn"]')
            };
            _.category = {
                name: _container.querySelector('input[id="highlighter-create-category-name"]'),
                textColorSelector: _container.querySelector('input[id="highlighter-create-category-text-color"]'),
                backgroundColorSelector: _container.querySelector('input[id="highlighter-create-category-background-color"]'),
                customCssTextArea: _container.querySelector('textarea[id="highlighter-create-custom-css-text-area"]'),
                addButton: _container.querySelector('button[id="highlighter-add-category-btn"]')
            };

            $(_.category.textColorSelector).spectrum({
                color: "#000000",
                showAlpha: true
            });

            $(_.category.backgroundColorSelector).spectrum({
                color: "#ffff00",
                showAlpha: true
            });

            return this;
        }
    }
    function Option(text, value) {
        let option = document.createElement('option');
        option.text = text;
        option.value = value;
        return option;
    }

    _highlighter.attachUI(this);
    return _highlighter;
}