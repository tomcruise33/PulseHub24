"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseSource = exports.SourceType = void 0;
const events_1 = require("events");
var SourceType;
(function (SourceType) {
    SourceType["GOVERNMENT"] = "government";
    SourceType["BIG_MEDIA"] = "big_media";
    SourceType["LOCAL_MEDIA"] = "local_media";
    SourceType["SOCIAL_MEDIA"] = "social_media";
})(SourceType || (exports.SourceType = SourceType = {}));
class BaseSource extends events_1.EventEmitter {
    constructor(name, type, baseCredibilityScore, updateInterval) {
        super();
        this.isActive = false;
        this.name = name;
        this.type = type;
        this.baseCredibilityScore = baseCredibilityScore;
        this.updateInterval = updateInterval;
    }
    async start() {
        if (this.isActive)
            return;
        this.isActive = true;
        const runUpdate = async () => {
            if (!this.isActive)
                return;
            try {
                const articles = await this.fetchArticles();
                this.emit('articles', articles);
            }
            catch (error) {
                this.emit('error', error);
            }
            if (this.isActive) {
                setTimeout(runUpdate, this.updateInterval);
            }
        };
        await runUpdate();
    }
    stop() {
        this.isActive = false;
    }
    getName() {
        return this.name;
    }
    getType() {
        return this.type;
    }
    getCredibilityScore() {
        return this.baseCredibilityScore;
    }
}
exports.BaseSource = BaseSource;
